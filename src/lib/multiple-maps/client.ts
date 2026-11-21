import { geocodeResultSchema, type GeocodeResult, type MapConfig } from './schema';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const reason = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;

export async function api(path: string, method = 'GET', data?: unknown, headers?: HeadersInit, signal?: AbortSignal): Promise<unknown> {
  const requestHeaders = new Headers(headers);
  if (data !== undefined) requestHeaders.set('Content-Type', 'application/json');
  const response = await fetch(path, { method, headers: requestHeaders, body: data === undefined ? undefined : JSON.stringify(data), signal });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(response.status, typeof payload?.error === 'string' ? payload.error : 'The map service is temporarily unavailable.');
  }
  return payload;
}

interface Turnstile {
  render(target: HTMLElement, options: { sitekey: string; action: string; callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }): string;
  remove(widget: string): void;
}

let turnstileScript: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  if (turnstileScript) return turnstileScript;
  turnstileScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      turnstileScript = undefined;
      reject(new ApiError(503, 'Human verification could not load. Please try again.'));
    };
    const timer = window.setTimeout(fail, 10000);
    script.onerror = fail;
    script.onload = () => {
      const widget = (window as Window & { turnstile?: Turnstile }).turnstile;
      if (!widget) return fail();
      clearTimeout(timer);
      resolve(widget);
    };
    document.head.append(script);
  });
  return turnstileScript;
}

export async function verify(siteKey: string, action: 'geocode' | 'publish-map'): Promise<string> {
  if (!siteKey) throw new ApiError(503, 'Human verification is unavailable.');
  const turnstile = await loadTurnstile();
  const dialog = document.querySelector<HTMLDialogElement>('#mm-verification')!;
  const target = document.querySelector<HTMLElement>('#mm-turnstile')!;
  dialog.showModal();
  let widget: string | undefined;
  const closed = new AbortController();
  try {
    return await new Promise((resolve, reject) => {
      dialog.addEventListener('close', () => reject(new ApiError(400, 'Verification was canceled.')), { signal: closed.signal });
      widget = turnstile.render(target, {
        sitekey: siteKey, action, callback: resolve,
        'error-callback': () => reject(new ApiError(503, 'Verification failed. Please try again.')),
        'expired-callback': () => reject(new ApiError(400, 'Verification expired. Please try again.')),
      });
    });
  } finally {
    closed.abort();
    if (widget) turnstile.remove(widget);
    dialog.close();
  }
}

export function createGeocoder(siteKey: string) {
  let session: string | undefined;
  let sessionRequest: Promise<void> | undefined;
  const answers = new Map<string, GeocodeResult[]>();

  const unlocked = () => Boolean(session && Number(session.split('.')[0]) > Date.now() + 1000);

  function unlock(): Promise<void> {
    if (unlocked()) return Promise.resolve();
    if (!sessionRequest) {
      sessionRequest = (async () => {
        const verification = await verify(siteKey, 'geocode');
        const result = await api('/api/map-tool/session', 'POST', { verification }) as { session?: string };
        if (!result.session) throw new ApiError(503, 'Location search is unavailable.');
        session = result.session;
      })().finally(() => { sessionRequest = undefined; });
    }
    return sessionRequest;
  }

  async function search(query: string, mode: 'autocomplete' | 'search' | 'bulk', signal?: AbortSignal): Promise<GeocodeResult[]> {
    const key = `${mode === 'autocomplete' ? 'suggest' : 'address'}:${query.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()}`;
    const known = answers.get(key);
    if (known) return known;
    if (!unlocked()) throw new ApiError(403, 'Verify that you are human to continue location search.');
    const result = await api('/api/geocode', 'POST', { query, mode }, { 'X-Geocode-Session': session! }, signal) as { results?: unknown };
    const values = geocodeResultSchema.array().parse(result.results);
    if (answers.size >= 150) answers.delete(answers.keys().next().value!);
    answers.set(key, values);
    return values;
  }
  return { unlocked, unlock, search };
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function links(id: string, config: MapConfig) {
  const embed = new URL(`/embed/${id}`, location.origin).href;
  const share = new URL(`/map/${id}`, location.origin).href;
  const { width, height, responsive } = config.settings;
  const code = `<iframe\n  src="${embed}"\n  width="${responsive ? '100%' : width}"\n  height="${height}"\n  style="border:0;max-width:100%;"\n  loading="lazy"\n  title="${escapeAttribute(config.title)}"\n></iframe>`;
  return { code, share };
}
