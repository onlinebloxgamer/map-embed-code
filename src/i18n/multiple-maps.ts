import type { Locale } from './config';

export const multipleMapsPath = '/multiple-location-map-generator/';
export const multiplePinsGuidePath = '/guides/how-to-create-map-with-multiple-pins/';

export const multipleMapsNavigation = {
  en: { home: 'Home', guides: 'Guides', breadcrumb: 'Breadcrumb', tool: 'Multiple Location Map' },
  es: { home: 'Inicio', guides: 'Guías', breadcrumb: 'Ruta de navegación', tool: 'Mapa con varias ubicaciones' },
  de: { home: 'Startseite', guides: 'Anleitungen', breadcrumb: 'Brotkrümelnavigation', tool: 'Karte mit mehreren Standorten' },
} satisfies Record<Locale, Record<string, string>>;
