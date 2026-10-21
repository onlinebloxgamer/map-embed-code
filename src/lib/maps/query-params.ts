// Encodes/decodes MapConfiguration to/from URL query parameters

import type { MapConfiguration } from './map-config.js';
import { DEFAULT_CONFIG } from './map-config.js';
import { validateLatitude, validateLongitude, validateZoom, validateDimension } from './validate-location.js';

export function configToParams(config: MapConfiguration): URLSearchParams {
    const params = new URLSearchParams();

    params.set('mode', config.locationMode);

    if (config.locationMode === 'address' && config.address) {
        params.set('q', config.address);
    }
    if (config.locationMode === 'coordinates' && config.latitude !== null && config.longitude !== null) {
        params.set('lat', String(config.latitude));
        params.set('lng', String(config.longitude));
    }
    if (config.locationMode === 'mymaps' && config.myMapsUrl) {
        params.set('mymaps', config.myMapsUrl);
    }

    params.set('zoom', String(config.zoom));
    params.set('type', config.mapType);

    if (config.widthUnit === '%') {
        params.set('w', `${config.width}%`);
    } else {
        params.set('w', String(config.width));
    }
    params.set('h', String(config.height));

    if (!config.responsive) params.set('responsive', '0');
    if (!config.lazyLoading) params.set('lazy', '0');
    if (!config.allowFullscreen) params.set('fs', '0');
    if (config.borderRadius > 0) params.set('br', String(config.borderRadius));
    if (config.iframeTitle !== DEFAULT_CONFIG.iframeTitle) params.set('title', config.iframeTitle);

    if (config.directionsMode) {
        params.set('dmode', '1');
        if (config.directionsFrom) params.set('from', config.directionsFrom);
        if (config.directionsTo) params.set('to', config.directionsTo);
    }

    return params;
}

export function paramsToConfig(params: URLSearchParams): MapConfiguration {
    const config: MapConfiguration = { ...DEFAULT_CONFIG };

    const mode = params.get('mode');
    if (mode === 'address' || mode === 'coordinates' || mode === 'mymaps') {
        config.locationMode = mode;
    }

    const q = params.get('q');
    if (q) config.address = q.slice(0, 500); // limit length

    const myMapsUrl = params.get('mymaps');
    if (myMapsUrl) config.myMapsUrl = myMapsUrl.slice(0, 4000);

    const lat = params.get('lat');
    const lng = params.get('lng');
    if (lat && lng) {
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        if (validateLatitude(latNum)) config.latitude = latNum;
        if (validateLongitude(lngNum)) config.longitude = lngNum;
    }

    const zoom = params.get('zoom');
    if (zoom) {
        const zNum = parseInt(zoom, 10);
        if (validateZoom(zNum)) config.zoom = zNum;
    }

    const type = params.get('type');
    if (type === 'roadmap' || type === 'satellite') config.mapType = type;

    const w = params.get('w');
    if (w) {
        if (w.endsWith('%')) {
            const wNum = parseFloat(w);
            if (!isNaN(wNum) && wNum > 0 && wNum <= 100) {
                config.width = wNum;
                config.widthUnit = '%';
            }
        } else {
            const wNum = parseInt(w, 10);
            if (validateDimension(wNum)) {
                config.width = wNum;
                config.widthUnit = 'px';
            }
        }
    }

    const h = params.get('h');
    if (h) {
        const hNum = parseInt(h, 10);
        if (validateDimension(hNum)) config.height = hNum;
    }

    const responsive = params.get('responsive');
    if (responsive === '0') config.responsive = false;
    if (responsive === '1') config.responsive = true;
    if (params.get('lazy') === '0') config.lazyLoading = false;
    if (params.get('fs') === '0') config.allowFullscreen = false;

    const br = params.get('br');
    if (br) {
        const brNum = parseInt(br, 10);
        if (!isNaN(brNum) && brNum >= 0 && brNum <= 50) config.borderRadius = brNum;
    }

    const title = params.get('title');
    if (title) config.iframeTitle = title.slice(0, 100);

    if (params.get('dmode') === '1') {
        config.directionsMode = true;
        const from = params.get('from');
        const to = params.get('to');
        if (from) config.directionsFrom = from.slice(0, 500);
        if (to) config.directionsTo = to.slice(0, 500);
    }

    return config;
}
