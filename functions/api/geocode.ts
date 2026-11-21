import { geocodeResultSchema, geocodeSchema } from '../../src/lib/multiple-maps/schema';
import { boundedLimit, lookupPhoton, photonEndpoint, searchCapabilities } from '../_shared/photon';
import { clientKey, database, digest, HttpError, json, rateLimit, readJson, respond, sameOrigin, verifySession, type Env } from '../_shared/runtime';

const geocodes = geocodeResultSchema.array();

export const onRequestPost: PagesFunction<Env> = ({ request, env, waitUntil }) => respond(async () => {
  sameOrigin(request);
  const input = geocodeSchema.safeParse(await readJson(request, 4096));
  if (!input.success) throw new HttpError(422, 'Enter a location between 3 and 300 characters.');
  const { query, mode } = input.data;
  const endpoint = photonEndpoint(env.PHOTON_BASE_URL);
  const capabilities = searchCapabilities(env);
  if (!endpoint || !capabilities.geocoding) throw new HttpError(503, 'Address search is unavailable. You can enter coordinates instead.');
  if (mode === 'autocomplete' && !capabilities.geocodeAutocomplete) throw new HttpError(403, 'Automatic suggestions are disabled. Submit the address to search.');
  if (mode === 'bulk' && !capabilities.geocodeBulk) throw new HttpError(403, 'Bulk address lookup is unavailable. Enter coordinates to add these rows.');

  const db = database(env);
  const client = await clientKey(request, env);
  await verifySession(request, env, client);
  await rateLimit(db, `geocode:${client}`, 60, boundedLimit(env.PHOTON_PER_CLIENT_PER_MINUTE, 30, 60));
  const normalized = query.normalize('NFC').replace(/\s+/g, ' ').trim();
  const isSubmitted = mode !== 'autocomplete';
  const key = await digest(`photon:v1:${endpoint.origin}:${normalized.toLowerCase()}`);
  const now = Math.floor(Date.now() / 1000);
  if (isSubmitted) {
    const cached = await db.prepare('SELECT result FROM map_geocodes WHERE key = ? AND expires_at > ?')
      .bind(key, now).first<{ result: string }>();
    if (cached) return json({ results: geocodes.parse(JSON.parse(cached.result)) });
  }

  await rateLimit(db, 'photon:second', 1, boundedLimit(env.PHOTON_REQUESTS_PER_SECOND, 2, 10));
  try {
    await rateLimit(db, 'photon:daily', 86400, boundedLimit(env.PHOTON_DAILY_LIMIT, 1000, 5000));
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) throw new HttpError(429, 'Today’s address lookup limit has been reached. Enter coordinates or try again tomorrow.');
    throw error;
  }
  const results = await lookupPhoton(endpoint, normalized);
  if (isSubmitted) {
    const ttl = results.length ? 30 * 86400 : 3600;
    waitUntil(db.prepare('INSERT OR REPLACE INTO map_geocodes (key, result, expires_at) VALUES (?, ?, ?)')
      .bind(key, JSON.stringify(results), now + ttl).run().catch(() => {}));
  }
  return json({ results });
});
