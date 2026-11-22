import type { Locale } from './config';
import en from './map-editor/en.json';
import es from './map-editor/es.json';
import de from './map-editor/de.json';

export type MapEditorCopy = typeof en;
export const editorCopy = { en, es, de } satisfies Record<Locale, MapEditorCopy>;

export { formatMapMessage } from './map-messages';
