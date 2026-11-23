import type { Locale } from './config';

export const multipleMapsPath = '/multiple-location-map-generator/';
export const multiplePinsGuidePath = '/guides/how-to-create-map-with-multiple-pins/';

export const multipleMapsNavigation = {
  en: { home: 'Home', guides: 'Guides', breadcrumb: 'Breadcrumb', tool: 'Multiple Location Map' },
  es: { home: 'Inicio', guides: 'Guías', breadcrumb: 'Ruta de navegación', tool: 'Mapa con varias ubicaciones' },
  de: { home: 'Startseite', guides: 'Anleitungen', breadcrumb: 'Brotkrümelnavigation', tool: 'Karte mit mehreren Standorten' },
} satisfies Record<Locale, Record<string, string>>;

export const multipleMapsFeatures = {
  en: [
    'Plot multiple locations on one map',
    'Add pins by coordinates or map click',
    'Import locations from CSV',
    'Customize marker colors, icons, and descriptions',
    'Share maps by link or responsive iframe',
    'Edit saved maps with a recovery file',
  ],
  es: [
    'Marcar varias ubicaciones en un mapa',
    'Añadir marcadores por coordenadas o con un clic en el mapa',
    'Importar ubicaciones desde un CSV',
    'Personalizar colores, iconos y descripciones de los marcadores',
    'Compartir mapas mediante un enlace o un iframe adaptable',
    'Editar mapas guardados con un archivo de recuperación',
  ],
  de: [
    'Mehrere Standorte auf einer Karte markieren',
    'Markierungen per Koordinaten oder Kartenklick hinzufügen',
    'Standorte aus einer CSV-Datei importieren',
    'Farben, Symbole und Beschreibungen der Markierungen anpassen',
    'Karten per Link teilen oder als responsiven Iframe einbetten',
    'Gespeicherte Karten mit einer Wiederherstellungsdatei bearbeiten',
  ],
} satisfies Record<Locale, string[]>;
