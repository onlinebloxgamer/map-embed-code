export const locales = ["en", "es", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const languageNames: Record<Locale, string> = {
    en: "English",
    es: "Español",
    de: "Deutsch",
};

export const languageCodes: Record<Locale, string> = {
    en: "EN",
    es: "ES",
    de: "DE",
};

export function isLocale(value: string | undefined): value is Locale {
    return locales.includes(value as Locale);
}

export function localizedPath(path: string, locale: Locale): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (locale === defaultLocale) return normalized;
    if (normalized === "/") return `/${locale}/`;
    return `/${locale}${normalized}`;
}

export function localizedUrl(path: string, locale: Locale, site: URL): string {
    return new URL(localizedPath(path, locale), site).href;
}

export const ogLocales: Record<Locale, string> = {
    en: "en_US",
    es: "es_ES",
    de: "de_DE",
};
