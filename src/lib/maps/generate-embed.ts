// Generates clean iframe HTML embed code

import type { MapConfiguration } from './map-config.js';
import { generateMapUrl } from './generate-url.js';

const ATTRIBUTION_URL = 'https://map-embed-code.com/';
const ATTRIBUTION_LINK = `<a href="${ATTRIBUTION_URL}">map-embed-code.com</a>`;

export function generateEmbedCode(config: MapConfiguration): string {
    const src = generateMapUrl(config);
    const safeTitle = escapeAttr(config.iframeTitle || 'Google Maps');

    const iframeStyles: string[] = [];
    if (config.borderRadius > 0) {
        iframeStyles.push(`border-radius:${config.borderRadius}px;`);
    }

    const iframeAttrs: string[] = [
        'class="gmap_iframe"',
        'frameborder="0"',
        'scrolling="no"',
        'marginheight="0"',
        'marginwidth="0"',
        `src="${src}"`,
        `title="${safeTitle}"`,
        'referrerpolicy="strict-origin-when-cross-origin"',
    ];

    if (config.allowFullscreen) {
        iframeAttrs.push('allowfullscreen=""');
    }
    if (config.lazyLoading) {
        iframeAttrs.push('loading="lazy"');
    }

    const outerSize = config.responsive
        ? `width:100%;aspect-ratio:${getAspectRatio(config)};`
        : `width:${config.width}${config.widthUnit};height:${config.height}px;max-width:100%;`;
    const iframeStyle = iframeStyles.join('');

    return `<div class="mapouter">\n  <div class="gmap_canvas">\n    <iframe\n      ${iframeAttrs.join('\n      ')}\n    ></iframe>\n    ${ATTRIBUTION_LINK}\n  </div>\n  <style>\n    .mapouter{position:relative;text-align:right;${outerSize}}\n    .gmap_canvas{overflow:hidden;background:none!important;width:100%;height:100%;}\n    .gmap_iframe{display:block;width:100%!important;height:100%!important;${iframeStyle}}\n  </style>\n</div>`;
}

function getAspectRatio(config: MapConfiguration): string {
    const w = config.width || 600;
    const h = config.height || 450;
    return `${w}/${h}`;
}

function escapeAttr(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
