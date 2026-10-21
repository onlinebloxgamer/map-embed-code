// Generates the Google Maps iframe source URL

import type { MapConfiguration } from './map-config.js';

/**
 * Builds the Google Maps embed URL.
 * Format: https://maps.google.com/maps?q=QUERY&z=ZOOM&t=TYPE&output=embed
 *
 * Map type parameter `t`:
 *   - '' or 'm' = roadmap (default)
 *   - 'k' = satellite
 */
export function generateMapUrl(config: MapConfiguration): string {
    if (config.locationMode === 'mymaps') {
        return normalizeMyMapsEmbedUrl(config.myMapsUrl) ?? 'about:blank';
    }
    if (config.directionsMode && config.directionsFrom && config.directionsTo) {
        return generateDirectionsUrl(config);
    }
    return generatePlaceUrl(config);
}

function generatePlaceUrl(config: MapConfiguration): string {
    let query: string;

    if (config.locationMode === 'coordinates' && config.latitude !== null && config.longitude !== null) {
        query = `${config.latitude},${config.longitude}`;
    } else if (config.address.trim()) {
        query = config.address.trim();
    } else {
        query = 'New York City, NY, USA';
    }

    const params = new URLSearchParams({
        q: query,
        z: String(config.zoom),
        output: 'embed',
    });

    if (config.mapType === 'satellite') {
        params.set('t', 'k');
    }

    return `https://maps.google.com/maps?${params.toString()}`;
}

function generateDirectionsUrl(config: MapConfiguration): string {
    const params = new URLSearchParams({
        saddr: config.directionsFrom.trim(),
        daddr: config.directionsTo.trim(),
        z: String(config.zoom),
        output: 'embed',
    });

    return `https://maps.google.com/maps?${params.toString()}`;
}

export function generateGoogleMapsLink(config: MapConfiguration): string {
    if (config.locationMode === 'mymaps') {
        const embedUrl = normalizeMyMapsEmbedUrl(config.myMapsUrl);
        if (!embedUrl) return 'https://www.google.com/mymaps';
        const viewerUrl = new URL(embedUrl);
        viewerUrl.pathname = viewerUrl.pathname.replace(/\/embed$/, '/viewer');
        return viewerUrl.toString();
    }
    if (config.locationMode === 'coordinates' && config.latitude !== null && config.longitude !== null) {
        return `https://www.google.com/maps?q=${config.latitude},${config.longitude}&z=${config.zoom}`;
    }
    const q = encodeURIComponent(config.address.trim() || 'New York City');
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Accepts either a Google My Maps URL or the iframe HTML copied from
 * "Embed on my site", then returns a safe canonical embed URL.
 */
export function normalizeMyMapsEmbedUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const iframeSrc = trimmed.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    const candidate = (iframeSrc ?? trimmed).replace(/&amp;/gi, '&');

    try {
        const url = new URL(candidate);
        const validHost = url.hostname === 'www.google.com' || url.hostname === 'google.com';
        const validPath = /^\/maps\/d\/(?:u\/\d+\/)?(?:embed|viewer|edit)$/.test(url.pathname);

        if (url.protocol !== 'https:' || !validHost || !validPath || !url.searchParams.get('mid')) {
            return null;
        }

        url.hostname = 'www.google.com';
        url.pathname = url.pathname.replace(/\/(?:viewer|edit)$/, '/embed');
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}
