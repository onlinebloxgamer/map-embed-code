import { z } from 'zod';
import { challenge, clientKey, database, HttpError, issueSession, json, rateLimit, readJson, respond, sameOrigin, type Env } from '../../_shared/runtime';
import { searchCapabilities } from '../../_shared/photon';

const body = z.object({ verification: z.string().min(1).max(2048) });

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => respond(async () => {
  sameOrigin(request);
  if (!searchCapabilities(env).geocoding) throw new HttpError(503, 'Address search is unavailable. You can enter coordinates instead.');
  const input = body.safeParse(await readJson(request, 4096));
  if (!input.success) throw new HttpError(422, 'Complete human verification to search.');
  const client = await clientKey(request, env);
  await rateLimit(database(env), `verify:${client}`, 60, 8);
  await challenge(request, env, input.data.verification, 'geocode');
  return json({ session: await issueSession(env, client) });
});
