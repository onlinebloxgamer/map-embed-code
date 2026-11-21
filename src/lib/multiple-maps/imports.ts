import { coordinate, latitude, longitude, markerSchema, type Marker } from './schema';

export interface ImportRow {
  title: string;
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  color: string;
}

const blank = () => ({ title: '', address: '', description: '', latitude: '', longitude: '', color: 'red' });

export function pasteRows(value: string): ImportRow[] {
  return value.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const [address, ...description] = line.split('|');
    return { ...blank(), address: address.trim(), description: description.join('|').trim() };
  });
}

export async function csvRows(value: string): Promise<ImportRow[]> {
  const { default: Papa } = await import('papaparse');
  const csv = Papa.parse<Record<string, string>>(value.replace(/^\uFEFF/, ''), {
    header: true, skipEmptyLines: 'greedy', delimiter: ',', transformHeader: (header) => header.trim().toLowerCase(),
  });
  if (csv.errors.length) throw new Error(`CSV row ${(csv.errors[0].row ?? 0) + 2} could not be read. Check quoting and column counts.`);
  const fields = csv.meta.fields ?? [];
  if (!fields.includes('address') && !((fields.includes('lat') || fields.includes('latitude')) && (fields.includes('lon') || fields.includes('longitude')))) {
    throw new Error('The CSV needs an address column or both lat and lon columns.');
  }
  return csv.data.map((row) => ({
    title: row.title?.trim() ?? '', address: row.address?.trim() ?? '', description: row.description?.trim() ?? '',
    latitude: row.lat?.trim() || row.latitude?.trim() || '', longitude: row.lon?.trim() || row.longitude?.trim() || '', color: row.color?.trim().toLowerCase() || 'red',
  }));
}

export function validateRow(row: ImportRow): { marker?: Marker; issue?: string } {
  if (row.latitude || row.longitude) {
    const lat = latitude.safeParse(coordinate(row.latitude));
    const lng = longitude.safeParse(coordinate(row.longitude));
    if (!lat.success || !lng.success) return { issue: 'Enter both valid coordinates or clear them and use an address.' };
    const marker = markerSchema.safeParse({ ...row, title: row.title || row.address || 'Map location', lat: lat.data, lng: lng.data });
    if (!marker.success) return { issue: `Check ${marker.error.issues[0].path.join(' ')}.` };
    return { marker: marker.data };
  }
  if (row.address.length < 3 || row.address.length > 300) return { issue: 'Enter an address of 3–300 characters.' };
  const test = markerSchema.safeParse({ ...row, title: row.title || 'Map location', lat: 0, lng: 0 });
  if (!test.success) return { issue: `Check ${test.error.issues[0].path.join(' ')}.` };
  return {};
}
