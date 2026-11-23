import { localizedUrl, type Locale } from '../i18n/config';
import { multipleMapsNavigation } from '../i18n/multiple-maps';

interface GuidePage {
  site: URL;
  url: string;
  lang: Locale;
  title: string;
  description: string;
}

interface GuideArticle extends GuidePage {
  image: string;
  datePublished?: string;
  dateModified?: string;
}

export function guideArticleStructuredData({ site, url, lang, title, description, image, datePublished, dateModified }: GuideArticle) {
  const organization = { '@type': 'Organization', name: 'Map Embed Code', url: new URL('/', site).href };
  const navigation = multipleMapsNavigation[lang];
  const crumbs = [
    { name: navigation.home, item: localizedUrl('/', lang, site) },
    { name: navigation.guides, item: localizedUrl('/guides/', lang, site) },
    { name: title, item: url },
  ];

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      image: new URL(image, site).href,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: lang,
      author: organization,
      publisher: {
        ...organization,
        logo: { '@type': 'ImageObject', url: new URL('/favicon-96x96.png', site).href },
      },
      datePublished,
      dateModified,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
    },
  ];
}

export function guideIndexStructuredData({ site, url, lang, title, description }: GuidePage, guides: { title: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url,
    inLanguage: lang,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: guides.map((guide, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: guide.title,
        url: new URL(guide.href, site).href,
      })),
    },
  };
}
