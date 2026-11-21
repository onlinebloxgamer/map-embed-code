import { markerLimit } from '../../../src/lib/multiple-maps/schema';
import { json, type Env } from '../../_shared/runtime';
import { searchCapabilities } from '../../_shared/photon';

export const onRequestGet: PagesFunction<Env> = ({ env }) => json({
  markerLimit: markerLimit(env.MAP_MARKER_LIMIT),
  turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? '',
  ...searchCapabilities(env),
}, 200, 'public, max-age=300');
