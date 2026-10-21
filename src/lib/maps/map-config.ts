// Map configuration types and defaults

export type LocationMode = 'address' | 'coordinates' | 'mymaps';
export type MapType = 'roadmap' | 'satellite';
export type DimensionPreset = 'small' | 'standard' | 'large' | 'fullwidth' | 'custom';

export interface MapConfiguration {
    locationMode: LocationMode;
    address: string;
    latitude: number | null;
    longitude: number | null;
    myMapsUrl: string;
    mapType: MapType;
    zoom: number;
    width: number | null;
    widthUnit: 'px' | '%';
    height: number;
    responsive: boolean;
    lazyLoading: boolean;
    allowFullscreen: boolean;
    borderRadius: number;
    iframeTitle: string;
    // Directions mode
    directionsMode: boolean;
    directionsFrom: string;
    directionsTo: string;
}

export const DEFAULT_CONFIG: MapConfiguration = {
    locationMode: 'address',
    address: 'New York City, NY, USA',
    latitude: null,
    longitude: null,
    myMapsUrl: '',
    mapType: 'roadmap',
    zoom: 7,
    width: 600,
    widthUnit: 'px',
    height: 450,
    responsive: true,
    lazyLoading: true,
    allowFullscreen: true,
    borderRadius: 0,
    iframeTitle: 'Google Maps',
    directionsMode: false,
    directionsFrom: '',
    directionsTo: '',
};

export const DIMENSION_PRESETS: Record<DimensionPreset, { width: number | null; widthUnit: 'px' | '%'; height: number; label: string }> = {
    small: { width: 300, widthUnit: 'px', height: 200, label: 'Small' },
    standard: { width: 600, widthUnit: 'px', height: 450, label: 'Standard' },
    large: { width: 800, widthUnit: 'px', height: 600, label: 'Large' },
    fullwidth: { width: 100, widthUnit: '%', height: 450, label: 'Full Width' },
    custom: { width: null, widthUnit: 'px', height: 450, label: 'Custom' },
};

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 21;
export const DIMENSION_MIN = 50;
export const DIMENSION_MAX = 4000;
