import { editToken, MAX_PAYLOAD_BYTES } from '../../src/lib/multiple-maps/schema';

export interface Env {
  MAPS_DB?: D1Database;
  ASSETS: Fetcher;
  MAP_MARKER_LIMIT?: string;
  PHOTON_BASE_URL?: string;
  PHOTON_ALLOW_AUTOCOMPLETE?: string;
  PHOTON_ALLOW_BULK?: string;
  PHOTON_DAILY_LIMIT?: string;
  PHOTON_REQUESTS_PER_SECOND?: string;
  PHOTON_PER_CLIENT_PER_MINUTE?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_HOSTNAME?: string;
  MAP_SESSION_SECRET?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200, cache = 'no-store'): Response {
  return Response.json(data, { status, headers: {
    'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
  } });
}

export async function respond(action: () => Promise<Response>): Promise<Response> {
  try { return await action(); }
  catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    return json({ error: 'The map service is temporarily unavailable. Please try again.' }, 503);
  }
}

export function database(env: Env): D1Database {
  if (!env.MAPS_DB) throw new HttpError(503, 'The map database is unavailable.');
  return env.MAPS_DB;
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'This request must come from the map website.');
}

export async function readJson(request: Request, max = MAX_PAYLOAD_BYTES): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
    throw new HttpError(415, 'Send an application/json request.');
  }
  if (Number(request.headers.get('content-length')) > max) throw new HttpError(413, 'This request exceeds the size limit.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'This request exceeds the size limit.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); }
  catch { throw new HttpError(400, 'Malformed JSON.'); }
}

const encode = (text: string) => new TextEncoder().encode(text);
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
export const random = (length: number) => hex(crypto.getRandomValues(new Uint8Array(length)));
export const digest = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encode(value))));

export async function clientKey(request: Request, env: Env): Promise<string> {
  if (!env.MAP_SESSION_SECRET || env.MAP_SESSION_SECRET.length < 32) {
    throw new HttpError(503, 'Request verification is unavailable.');
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  return digest(`${env.MAP_SESSION_SECRET}:${ip}`);
}

export async function rateLimit(db: D1Database, key: string, period: number, limit: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / period) * period;
  const result = await db.prepare(`INSERT INTO map_rate_limits (key, window, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET window = excluded.window,
      count = CASE WHEN map_rate_limits.window = excluded.window THEN map_rate_limits.count + 1 ELSE 1 END
    WHERE map_rate_limits.window < excluded.window OR (map_rate_limits.window = excluded.window AND map_rate_limits.count < ?)
    RETURNING count`).bind(key, window, limit).first<{ count: number }>();
  if (!result) throw new HttpError(429, 'Too many requests. Wait before trying again.');
}

export async function authorizeMap(request: Request, env: Env): Promise<string> {
  sameOrigin(request);
  const token = editToken.safeParse(/^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]);
  if (!token.success) throw new HttpError(401, 'A valid map edit credential is required.');
  await rateLimit(database(env), `manage:${await clientKey(request, env)}`, 60, 25);
  return digest(token.data);
}

export async function challenge(request: Request, env: Env, token: string, action: string): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) throw new HttpError(503, 'Human verification is unavailable.');
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body, signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new HttpError(503, 'Human verification is temporarily unavailable.');
  const verification = await response.json() as { success: boolean; hostname?: string; action?: string };
  const hostname = env.TURNSTILE_HOSTNAME ?? new URL(request.url).hostname;
  if (!verification.success || verification.hostname !== hostname || verification.action !== action) {
    throw new HttpError(403, 'Complete human verification and try again.');
  }
}

async function sessionKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encode(env.MAP_SESSION_SECRET!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueSession(env: Env, client: string): Promise<string> {
  const expires = Date.now() + 30 * 60 * 1000;
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), encode(`${client}:${expires}`));
  return `${expires}.${hex(new Uint8Array(signature))}`;
}

export async function verifySession(request: Request, env: Env, client: string): Promise<void> {
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(request.headers.get('X-Geocode-Session') ?? '');
  if (match && Number(match[1]) > Date.now()) {
    const signature = Uint8Array.from(match[2].match(/../g)!, (part) => parseInt(part, 16));
    if (await crypto.subtle.verify('HMAC', await sessionKey(env), signature, encode(`${client}:${match[1]}`))) return;
  }
  throw new HttpError(403, 'Verify that you are human to continue location search.');
}
