import { z } from 'zod';
import { mapId, mapSchema } from '../../../src/lib/multiple-maps/schema';
import { authorizeMap, database, HttpError, json, readJson, respond, type Env } from '../../_shared/runtime';

const input = z.object({ id: mapId });

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => respond(async () => {
  const hash = await authorizeMap(request, env);
  const body = input.safeParse(await readJson(request, 4096));
  if (!body.success) throw new HttpError(422, 'Provide a valid map ID.');
  const { id } = body.data;
  const row = await database(env).prepare('SELECT configuration FROM maps WHERE id = ? AND edit_token_hash = ?')
    .bind(id, hash).first<{ configuration: string }>();
  if (!row) throw new HttpError(403, 'The map is unavailable or the edit credential is incorrect.');
  return json({ id, configuration: mapSchema.parse(JSON.parse(row.configuration)) });
});
