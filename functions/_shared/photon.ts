import { z } from 'zod';
import { geocodeResultSchema, type GeocodeResult } from '../../src/lib/multiple-maps/schema';
import { HttpError, type Env } from './runtime';

const label = z.string().trim().optional();
const feature = z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: z.array(z.number()).min(2) }),
  properties: z.object({
    name: label, housenumber: label, street: label, locality: label, district: label,
    city: label, county: label, state: label, postcode: label, country: label, type: label,
  }),
});
const collection = z.object({ features: z.array(z.unknown()) });

export function photonEndpoint(value?: string): URL | undefined {
  try {
    const origin = new URL(value ?? '');
    const host = origin.hostname;
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/'
      || origin.search || origin.hash || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host)
      || /(?:^|\.)(?:localhost|local|internal|lan|home|onion|test|invalid)$/.test(host)
            || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
    return new URL('/api', origin);
  } catch { return undefined; }
}

export function searchCapabilities(env: Env) {
  const geocoding = Boolean(photonEndpoint(env.PHOTON_BASE_URL) && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY
    && env.MAP_SESSION_SECRET && env.MAP_SESSION_SECRET.length >= 32 && env.MAPS_DB);
  return {
    geocoding,
    geocodeAutocomplete: geocoding && env.PHOTON_ALLOW_AUTOCOMPLETE === 'true',
    geocodeBulk: geocoding && env.PHOTON_ALLOW_BULK === 'true',
  };
}

export function boundedLimit(value: string | undefined, fallback: number, max: number): number {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? Math.min(amount, max) : fallback;
}

export async function lookupPhoton(endpoint: URL, query: string): Promise<GeocodeResult[]> {
  endpoint.search = new URLSearchParams({ q: query, limit: '5' }).toString();
  try {
    const response = await fetch(endpoint.href, {
      redirect: 'manual', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5500),
    });
    if (response.status === 429) throw new HttpError(429, 'Address search is busy. Try later or enter coordinates.');
    if (!response.ok || Number(response.headers.get('content-length')) > 131072) throw new Error('Photon response failed');
    const data = collection.parse(await response.json());
    const results: GeocodeResult[] = [];
    for (const raw of data.features.slice(0, 5)) {
      const item = feature.safeParse(raw);
      if (!item.success) continue;
      const [lng, lat] = item.data.geometry.coordinates;
      const p = item.data.properties;
      const street = [p.housenumber, p.street].filter(Boolean).join(' ');
      const address = [...new Set([p.name, street, p.locality, p.district, p.city, p.county, p.state, p.postcode, p.country].filter(Boolean))].join(', ');
      if (!address) continue;
      const match = geocodeResultSchema.safeParse({ title: (p.name || street || address).slice(0, 120), address: address.slice(0, 300), lat, lng, matchType: p.type });
      if (match.success) results.push(match.data);
    }
    return results;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Address search is temporarily unavailable. Try again or enter coordinates.');
  }
}
