import { createHash } from 'node:crypto';

export const origin = 'https://map-embed-code.com';
export const sitemapUrl = origin + '/sitemap-index.xml';
export const endpoint = 'https://api.indexnow.org/indexnow';

const reserved = new Set([
  'account', 'admin', 'administrator', 'api', 'assets', 'auth', 'cms', 'dashboard', 'draft', 'drafts',
  'embed', 'internal', 'login', 'logout', 'map', 'map-viewer', 'preview',
  'private', 'recover', 'recovery', 'search', 'settings', 'signin', 'sign-in', 'signup', 'staging',
  'wp-admin', 'wp-json', 'wp-login',
]);
const routeSegment = /^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u;

export function editorialUrl(value) {
  if (value === origin) value += '/';
  if (typeof value !== 'string' || value.length > 2048 || /[?#]/.test(value)
    || (!value.startsWith('/') && !value.startsWith(origin + '/'))) return null;
  let url;
  try { url = new URL(value, origin); }
  catch { return null; }
  if (url.origin !== origin || url.username || url.password || url.pathname.includes('//')) return null;
  // Reject normalization tricks, files, and non-editorial route families.
  if (value !== url.href && value !== url.pathname) return null;
  const path = url.pathname.slice(1).replace(/\/$/, '');
  if (path) {
    try {
      const segments = path.split('/').map((segment) => decodeURIComponent(segment));
      if (segments.some((segment) => !routeSegment.test(segment) || reserved.has(segment.toLowerCase())
        || /^(?:4|5)\d\d$/.test(segment))) return null;
    } catch { return null; }
  }
  return url.href;
}

const entities = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ' };
function decode(value, strict = false) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][\w]*);|&/gi, (token, entity) => {
    if (entity && Object.hasOwn(entities, entity)) return entities[entity];
    if (entity?.startsWith('#')) {
      const point = /^#x/i.test(entity) ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)) {
        return String.fromCodePoint(point);
      }
    }
    if (strict) throw new Error('Invalid XML entity in sitemap location.');
    return token;
  });
}

// Read only each entry's direct <loc>. Check nesting and require one location
// per entry so malformed XML cannot accidentally imply that pages disappeared.
export function parseSitemap(xml) {
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z_][\w:.-]*(?:"[^"]*"|'[^']*'|[^"'<>])*>|[^<]+|</g;
  const invalid = () => { throw new Error('Malformed or unsupported sitemap XML.'); };
  const stack = [];
  const locations = [];
  let kind;
  let prefix = '';
  let entryLocation;
  let readingLocation = false;
  let locationText = '';

  function close(name) {
    if (stack.pop() !== name) invalid();
    if (readingLocation && stack.length === 2) {
      entryLocation = decode(locationText, true).trim();
      if (!entryLocation || /\s/.test(entryLocation)) invalid();
      readingLocation = false;
    }
    if (stack.length === 1) {
      if (!entryLocation) invalid();
      locations.push(entryLocation);
    }
  }

  for (const [token] of xml.matchAll(tokens)) {
    if (token.startsWith('<!--') || token.startsWith('<?')) continue;
    if (!token.startsWith('<') || token.startsWith('<![CDATA[')) {
      if (readingLocation) locationText += token.startsWith('<![')
        ? token.slice(9, -3).replaceAll('&', '&amp;') : token;
      else if (stack.length < 3 && token.trim()) invalid();
      continue;
    }
    const name = token.match(/^<\/?([A-Za-z_][\w:.-]*)/)?.[1];
    if (!name) invalid();
    if (token.startsWith('</')) {
      if (token.slice(name.length + 2, -1).trim()) invalid();
      close(name);
      continue;
    }
    if (readingLocation) invalid();
    if (!stack.length) {
      if (kind) invalid();
      const root = name.split(':').at(-1);
      kind = root === 'sitemapindex' ? 'index' : root === 'urlset' ? 'urls' : invalid();
      prefix = name.slice(0, name.length - root.length);
    } else if (stack.length === 1) {
      if (name !== prefix + (kind === 'index' ? 'sitemap' : 'url')) invalid();
      entryLocation = undefined;
    } else if (stack.length === 2 && name === prefix + 'loc') {
      if (entryLocation !== undefined) invalid();
      readingLocation = true;
      locationText = '';
    }
    stack.push(name);
    if (token.endsWith('/>')) close(name);
  }
  if (stack.length || !kind) invalid();
  return { kind, locations };
}

export function robotsRules(text) {
  const groups = [];
  let group;
  let readingRules = false;
  for (const line of text.split(/\r?\n/)) {
    const [, field, value] = line.split('#', 1)[0].match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/) ?? [];
    const key = field?.toLowerCase();
    if (key === 'user-agent' && value) {
      if (!group || readingRules) {
        group = [];
        groups.push(group);
      }
      readingRules = false;
    } else if (group && (key === 'allow' || key === 'disallow')) {
      readingRules = true;
      if (!value) continue;
      const end = value.endsWith('$');
      const pattern = (end ? value.slice(0, -1) : value).split('*')
        .map((part) => part.replace(/[.*+?^{}$()|[\]\\]/g, '\\$&')).join('.*');
      group.push({ pattern: new RegExp('^' + pattern + (end ? '$' : '')), size: value.replace(/[*$]/g, '').length, allow: key === 'allow' });
    }
  }
  // IndexNow shares notifications among engines. Conservatively skip blocked paths.
  return (url) => {
    const path = new URL(url).pathname;
    return !groups.some((rules) => {
      let best;
      for (const rule of rules) {
        if (rule.pattern.test(path) && (!best || rule.size > best.size || (rule.size === best.size && rule.allow))) best = rule;
      }
      return best && !best.allow;
    });
  };
}

const noindex = /(?:^|[\s,:;])(?:noindex|none)(?:$|[\s,;])/i;
const tagAttributes = /([^\s=\/<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const markup = /<\/?([a-z][\w:-]*)(?:"[^"]*"|'[^']*'|[^"'<>])*>/gi;
const whitespace = (value) => decode(value).replace(/\s+/g, ' ').trim();

function attributes(tag) {
  return Object.fromEntries(Array.from(tag.matchAll(tagAttributes), ([, key, double, single, plain]) =>
    [key.toLowerCase(), decode(double ?? single ?? plain ?? '')]));
}

const stableAttributes = new Set([
  'alt', 'aria-label', 'checked', 'colspan', 'datetime', 'download', 'for', 'height', 'href',
  'id', 'lang', 'name', 'placeholder', 'poster', 'role', 'rowspan', 'selected', 'src', 'srcset',
  'title', 'type', 'value', 'width',
]);
const stableElements = /^(?:a|abbr|article|aside|blockquote|button|caption|code|dd|details|div|dl|dt|em|figcaption|figure|form|h[1-6]|hr|iframe|img|input|label|li|ol|option|p|picture|pre|section|select|small|source|strong|summary|table|td|textarea|th|time|tr|ul|video)$/;
const volatileJson = /^(?:datePublished|dateModified|lastmod|generatedAt|buildTime|buildTimestamp)$/i;

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).filter((key) => !volatileJson.test(key)).sort()
      .map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function cleanMarkup(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
}

export function pageFingerprint(html, url, robotsHeader = '') {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1];
  if (!head) throw new Error('Response does not contain an HTML head.');
  const fields = {};
  const canonicals = [];
  let blocked = noindex.test(robotsHeader);
  for (const [tag, tagName] of cleanMarkup(head).matchAll(markup)) {
    const { name, content, property, rel, href, hreflang } = attributes(tag.slice(tagName.length + 1, -1));
    if (tagName.toLowerCase() === 'meta') {
      if (/^(?:robots|\w*bot)$/i.test(name ?? '') && noindex.test(content ?? '')) blocked = true;
      const field = (property ?? name ?? '').toLowerCase();
      if (['description', 'og:title', 'og:description', 'og:image'].includes(field)) fields[field] = whitespace(content ?? '');
    }
    if (tagName.toLowerCase() === 'link') {
      const relationships = (rel ?? '').toLowerCase().split(/\s+/);
      if (relationships.includes('canonical')) canonicals.push(href);
      if (relationships.includes('alternate') && hreflang) fields['alternate:' + hreflang] = href;
    }
  }
  if (blocked) return { reason: 'noindex' };
  let canonical;
  try { if (canonicals.length === 1 && canonicals[0]) canonical = new URL(canonicals[0], url).href; }
  catch { /* Invalid canonical. */ }
  if (canonical !== url) return { reason: 'not self-canonical' };

  const title = whitespace(head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '');
  const schemas = [];
  for (const [, json] of head.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { schemas.push(JSON.stringify(stableJson(JSON.parse(json)))); }
    catch { /* Malformed structured data is not a content fingerprint input. */ }
  }
  const article = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1]
    ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1];
  if (!article) throw new Error('Response does not contain HTML page content.');
  const main = cleanMarkup(article).replace(/<([a-z][\w-]*)\b[^>]*\bdata-build-(?:time|timestamp)(?=[\s=>])[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const parts = [];
  let previous = 0;
  for (const match of main.matchAll(markup)) {
    const [tag, rawName] = match;
    const text = whitespace(main.slice(previous, match.index));
    if (text) parts.push(text);
    previous = match.index + tag.length;
    const name = rawName.toLowerCase();
    if (!stableElements.test(name)) continue;
    if (tag.startsWith('</')) parts.push(['end', name]);
    else {
      const attrs = Object.entries(attributes(tag.slice(rawName.length + 1, -1)))
        .filter(([key, value]) => stableAttributes.has(key) && !(key === 'id' && /^(?:astro-|:r)/i.test(value)))
        .sort(([a], [b]) => a.localeCompare(b));
      parts.push(['start', name, attrs]);
    }
  }
  const tail = whitespace(main.slice(previous));
  if (tail) parts.push(tail);
  const normalized = JSON.stringify([title, stableJson(fields), schemas.sort(), parts]);
  return { hash: createHash('sha256').update(normalized).digest('hex') };
}
