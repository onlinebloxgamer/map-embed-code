import { mapId, mapSchema, markerLimit } from '../../../src/lib/multiple-maps/schema';
import { authorizeMap, database, HttpError, json, readJson, respond, type Env } from '../../_shared/runtime';
import { invalidatePublicMap, publicMap } from '../../_shared/public-map';

function getId(input: unknown): string {
  const id = mapId.safeParse(input);
  if (!id.success) throw new HttpError(404, 'This map is unavailable.');
  return id.data;
}

export const onRequestGet: PagesFunction<Env> = ({ request, env, params, waitUntil }) => respond(async () => {
  return publicMap(request, env, getId(params.id), waitUntil);
});

export const onRequestPatch: PagesFunction<Env> = ({ request, env, params, waitUntil }) => respond(async () => {
  const id = getId(params.id);
  const hash = await authorizeMap(request, env);
  const input = mapSchema.safeParse(await readJson(request));
  const maximum = markerLimit(env.MAP_MARKER_LIMIT);
  if (!input.success || input.data.markers.length > maximum) throw new HttpError(422, `Provide valid settings and 1–${maximum} locations.`);
  const config = input.data;
  const result = await database(env).prepare(`UPDATE maps SET title = ?, description = ?, configuration = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND edit_token_hash = ?`).bind(config.title, config.description, JSON.stringify(config), id, hash).run();
  if (!result.meta.changes) throw new HttpError(403, 'This credential cannot edit the requested map.');
  waitUntil(invalidatePublicMap(request, id));
  return json({ id });
});

export const onRequestDelete: PagesFunction<Env> = ({ request, env, params, waitUntil }) => respond(async () => {
  const id = getId(params.id);
  const hash = await authorizeMap(request, env);
  const result = await database(env).prepare('DELETE FROM maps WHERE id = ? AND edit_token_hash = ?').bind(id, hash).run();
  if (!result.meta.changes) throw new HttpError(403, 'This credential cannot delete the requested map.');
  waitUntil(invalidatePublicMap(request, id));
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
});

export const onRequest: PagesFunction<Env> = () => json({ error: 'Method not allowed.' }, 405);
