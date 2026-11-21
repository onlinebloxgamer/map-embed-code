import { z } from 'zod';
import { mapSchema, markerLimit } from '../../../src/lib/multiple-maps/schema';
import { challenge, clientKey, database, digest, HttpError, json, random, rateLimit, readJson, respond, sameOrigin, type Env } from '../../_shared/runtime';

const createSchema = z.object({ configuration: mapSchema, verification: z.string().min(1).max(2048) });

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => respond(async () => {
  sameOrigin(request);
  const input = createSchema.safeParse(await readJson(request));
  const maximum = markerLimit(env.MAP_MARKER_LIMIT);
  if (!input.success || input.data.configuration.markers.length > maximum) {
    throw new HttpError(422, `Provide valid settings and 1–${maximum} locations.`);
  }
  const db = database(env);
  const client = await clientKey(request, env);
  await rateLimit(db, `create:${client}`, 60, 12);
  await challenge(request, env, input.data.verification, 'publish-map');
  const { configuration } = input.data;
  const id = random(16);
  const token = random(32);
  await db.prepare('INSERT INTO maps (id, title, description, configuration, edit_token_hash) VALUES (?, ?, ?, ?, ?)')
    .bind(id, configuration.title, configuration.description, JSON.stringify(configuration), await digest(token)).run();
  return json({ id, token }, 201);
});

export const onRequest: PagesFunction<Env> = () => json({ error: 'Use POST to create a map.' }, 405);
