import { coordinate, latitude, longitude, markerSchema, type Marker } from './schema';
import type { MapEditorCopy } from '../../i18n/map-editor';
import defaultCopy from '../../i18n/map-editor/en.json';
import { formatMapMessage } from '../../i18n/map-messages';

export interface ImportRow {
  title: string;
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  color: string;
}

export async function csvRows(value: string, copy = defaultCopy): Promise<ImportRow[]> {
  const { default: Papa } = await import('papaparse');
  const csv = Papa.parse<Record<string, string>>(value.replace(/^\uFEFF/, ''), {
    header: true, skipEmptyLines: 'greedy', delimiter: ',', transformHeader: (header) => header.trim().toLowerCase(),
  });
  if (csv.errors.length) throw new Error(formatMapMessage(copy.csvRowError, { row: (csv.errors[0].row ?? 0) + 2 }));
  const fields = csv.meta.fields ?? [];
  if (!fields.includes('address') && !((fields.includes('lat') || fields.includes('latitude')) && (fields.includes('lon') || fields.includes('longitude')))) {
    throw new Error(copy.csvColumns);
  }
  return csv.data.map((row) => ({
    title: row.title?.trim() ?? '', address: row.address?.trim() ?? '', description: row.description?.trim() ?? '',
    latitude: row.lat?.trim() || row.latitude?.trim() || '', longitude: row.lon?.trim() || row.longitude?.trim() || '', color: row.color?.trim().toLowerCase() || 'red',
  }));
}

export function validateRow(row: ImportRow, copy = defaultCopy): { marker?: Marker; issue?: string } {
  function checkField(path: PropertyKey[]) {
    const field = path.join(' ');
    return formatMapMessage(copy.checkField, { field: copy === defaultCopy ? field : copy[field as keyof MapEditorCopy] ?? field });
  }

  if (row.latitude || row.longitude) {
    const lat = latitude.safeParse(coordinate(row.latitude));
    const lng = longitude.safeParse(coordinate(row.longitude));
    if (!lat.success || !lng.success) return { issue: copy.invalidCoordinates };
    const marker = markerSchema.safeParse({ ...row, title: row.title || row.address || copy.mapLocation, lat: lat.data, lng: lng.data });
    if (!marker.success) return { issue: checkField(marker.error.issues[0].path) };
    return { marker: marker.data };
  }
  if (row.address.length < 3 || row.address.length > 300) return { issue: copy.invalidAddress };
  const test = markerSchema.safeParse({ ...row, title: row.title || copy.mapLocation, lat: 0, lng: 0 });
  if (!test.success) return { issue: checkField(test.error.issues[0].path) };
  return {};
}
