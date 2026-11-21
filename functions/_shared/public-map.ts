import { mapSchema } from '../../src/lib/multiple-maps/schema';
import { database, json, type Env } from './runtime';

type Lifetime = (promise: Promise<unknown>) => void;

function key(request: Request, id: string): Request {
  return new Request(new URL(`/api/maps/${id}`, request.url));
}

export async function publicMap(request: Request, env: Env, id: string, waitUntil: Lifetime): Promise<Response> {
  const cache = typeof caches === 'undefined' ? undefined : caches.default;
  const requestKey = key(request, id);
  const hit = await cache?.match(requestKey);
  if (hit) return hit;
  const row = await database(env).prepare('SELECT configuration FROM maps WHERE id = ?').bind(id).first<{ configuration: string }>();
  const response = row
    ? json({ id, configuration: mapSchema.parse(JSON.parse(row.configuration)) }, 200, 'public, max-age=0, s-maxage=60')
    : json({ error: 'This map is unavailable. It may have been deleted or the link may be incorrect.' }, 404, 'public, max-age=0, s-maxage=15');
  if (cache) waitUntil(cache.put(requestKey, response.clone()).catch(() => {}));
  return response;
}

export async function invalidatePublicMap(request: Request, id: string): Promise<void> {
  if (typeof caches !== 'undefined') await caches.default.delete(key(request, id)).catch(() => {});
}
