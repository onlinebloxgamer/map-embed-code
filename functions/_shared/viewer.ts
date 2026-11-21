import { mapId } from '../../src/lib/multiple-maps/schema';
import { publicMap } from './public-map';
import type { Env } from './runtime';

const csp = "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; connect-src 'self' https://tiles.openfreemap.org; base-uri 'none'; object-src 'none'; form-action 'none'";

export function viewer(embed: boolean): PagesFunction<Env> {
  return async ({ request, env, params, waitUntil }) => {
    const headers = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `${csp}; frame-ancestors ${embed ? '*' : "'self'"}`,
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, follow',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    const unavailable = () => new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Map unavailable</title><h1>This map is unavailable</h1><p>It may have been deleted or the link may be incorrect.</p></html>', { status: 404, headers });
    const id = mapId.safeParse(params.id);
    if (!id.success) return unavailable();
    try {
      const saved = await publicMap(request, env, id.data, waitUntil);
      if (saved.status === 404) return unavailable();
      const [payload, shell] = await Promise.all([saved.text(), env.ASSETS.fetch(new URL('/map-viewer/', request.url).toString())]);
      if (!shell.ok) throw new Error('Viewer shell unavailable');
      // JSON remains inert in the script element, including user strings with closing tags.
      const markup = payload.replaceAll('<', '\\u003c');
      return new HTMLRewriter().on('#saved-map-data', {
        element(node) { node.setInnerContent(markup, { html: true }); },
      }).transform(new Response(shell.body, { headers }));
    } catch { return new Response('The map viewer is temporarily unavailable.', { status: 503, headers }); }
  };
}
