// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    site: 'https://map-embed-code.com',
    i18n: {
        locales: ['en', 'es', 'de'],
        defaultLocale: 'en',
        routing: {
            prefixDefaultLocale: false,
        },
    },
    integrations: [
        sitemap({
            filter: (page) => !page.includes('?'),
        }),
    ],
    vite: {
        plugins: [tailwindcss()],
    },
});
