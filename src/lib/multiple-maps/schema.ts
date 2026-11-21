import { z } from 'zod';

export const DEFAULT_MARKER_LIMIT = 20;
export const MAX_MARKER_LIMIT = 100;
export const MAX_PAYLOAD_BYTES = 256 * 1024;
export const MAX_CSV_BYTES = 128 * 1024;
export const COLORS = {
  red: '#ba3a39', blue: '#2461ae', green: '#24693e', orange: '#a84813',
  purple: '#7540a0', yellow: '#986400', black: '#292929',
} as const;
// Keep the existing stored style IDs so published maps and recovery files remain valid.
export const STYLES = { streets: 'liberty', bright: 'bright', light: 'positron', dark: 'dark' } as const;
const namedColor = z.enum(['red', 'blue', 'green', 'orange', 'purple', 'yellow', 'black']);
export const colorSchema = z.union([namedColor, z.string().regex(/^#[0-9a-f]{6}$/i)]);
export const styleSchema = z.enum(['streets', 'bright', 'light', 'dark']);
export const iconSchema = z.enum(['pin', 'number', 'circle']);
export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);
export const mapId = z.string().regex(/^[a-f0-9]{32}$/);
export const editToken = z.string().regex(/^[a-f0-9]{64}$/);

const website = z.string().max(500).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Enter a complete http:// or https:// link.');

export const markerSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
  address: z.string().trim().max(300).default(''),
  lat: latitude,
  lng: longitude,
  color: colorSchema.default('red'),
  icon: iconSchema.default('number'),
  website: website.default(''),
});

export const settingsSchema = z.object({
  style: styleSchema.default('streets'),
  zoom: z.number().int().min(1).max(19).default(12),
  fit: z.boolean().default(true),
  zoomControls: z.boolean().default(true),
  scrollWheel: z.boolean().default(false),
  cluster: z.boolean().default(true),
  labels: z.boolean().default(false),
  width: z.number().int().min(240).max(2400).default(800),
  height: z.number().int().min(200).max(1200).default(450),
  responsive: z.boolean().default(true),
});

export const mapSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
  markers: z.array(markerSchema).min(1).max(MAX_MARKER_LIMIT),
  settings: settingsSchema,
});

export const geocodeSchema = z.object({
  query: z.string().trim().min(3).max(300),
  mode: z.enum(['autocomplete', 'search', 'bulk']),
});

export const geocodeResultSchema = z.object({
  title: z.string(), address: z.string(), lat: latitude, lng: longitude,
  confidence: z.number().min(0).max(1).optional(),
  matchType: z.string().optional(),
});

export const configSchema = z.object({
  markerLimit: z.number().int(),
  turnstileSiteKey: z.string(),
  geocoding: z.boolean(),
  geocodeAutocomplete: z.boolean().default(false),
  geocodeBulk: z.boolean().default(false),
});

export const recoverySchema = z.object({ id: mapId, token: editToken });
export type Marker = z.infer<typeof markerSchema>;
export type MapSettings = z.infer<typeof settingsSchema>;
export type MapConfig = z.infer<typeof mapSchema>;
export type GeocodeResult = z.infer<typeof geocodeResultSchema>;
export type PublicConfig = z.infer<typeof configSchema>;

export function markerColor(color: Marker['color']): string {
  return namedColor.safeParse(color).success ? COLORS[color as keyof typeof COLORS] : color;
}

export function markerLimit(value?: string): number {
  const configured = Number(value);
  return Number.isInteger(configured) && configured >= 1 && configured <= MAX_MARKER_LIMIT
    ? configured : DEFAULT_MARKER_LIMIT;
}

export function coordinate(value: string): number {
  const text = value.trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
}
