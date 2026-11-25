import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { batches, findKey, runIndexNow } from '../scripts/indexnow.mjs';
import { editorialUrl, endpoint, origin, pageFingerprint, parseSitemap, sitemapUrl } from '../scripts/indexnow-content.mjs';

const key = '1234567890abcdef'.repeat(2);
const keyLocation = origin + '/' + key + '.txt';
const release = 'successful-production-release';
const account = 'a'.repeat(32);
const cloudflare = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/pages/projects/map-embed-code';
const text = (body, type = 'text/plain', headers = {}) => new Response(body, { headers: { 'Content-Type': type, ...headers } });
const xml = (kind, element, urls) =>
  '<?xml version="1.0" encoding="UTF-8"?><' + kind + ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  urls.map((url) => '<' + element + '><loc>' + url + '</loc></' + element + '>').join('') + '</' + kind + '>';
const urlset = (urls) => xml('urlset', 'url', urls);
const sitemapIndex = (urls) => xml('sitemapindex', 'sitemap', urls);
const html = (url, copy, version = '1', extras = '') =>
  '<!doctype html><html><head><title>Guide ' + copy + '</title><link href="' + url + '" rel="canonical">' +
  '<meta content="Map help" name="description"><link rel="stylesheet" href="/_astro/site.' + version + '.css">' +
  '<script type="application/ld+json">{"headline":"Guide","dateModified":"' + version + '"}</script>' +
  extras + '</head><body><nav>Build ' + version + '</nav><main data-astro-cid-' + version + '><h1>' + copy +
  '</h1><time data-build-timestamp>' + version + '</time><script src="/_astro/site.' + version + '.js"></script>' +
  '<a href="/guides/">More guides</a></main></body></html>';

async function fixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'map-indexnow-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const keyDirectory = join(temp, 'public');
  await mkdir(keyDirectory);
  await writeFile(join(keyDirectory, key + '.txt'), key + '\n');
  const path = join(temp, 'private', 'manifest.json');
  const env = {
    INDEXNOW_MANIFEST: path, CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_INDEXNOW_TOKEN: 'test-read-token',
    INDEXNOW_DEPLOYMENT_ID: release,
  };
  const posts = [];
  const gets = [];
  const waits = [];
  const log = [];
  const responses = new Map();
  const overrides = { status: () => new Response(null, { status: 200 }) };
  let production = { id: release, environment: 'production', latest_stage: { name: 'deploy', status: 'success' } };
  const deployment = (value) => { production = { ...production, ...value }; };
  const listing = (urls) => {
    responses.set(sitemapUrl, () => text(sitemapIndex([origin + '/sitemap-0.xml']), 'application/xml'));
    responses.set(origin + '/sitemap-0.xml', () => text(urlset(urls), 'application/xml'));
  };
  const page = (url, copy, version, extras, headers) => {
    responses.set(url, () => text(html(url, copy, version, extras), 'text/html; charset=UTF-8', headers));
  };
  listing([origin + '/']);
  page(origin + '/', 'Home');
  const run = (mode, options) => runIndexNow({
    mode, env, keyDirectory,
    log: (value) => log.push(value),
    now: () => Date.parse('2026-11-25T00:00:00Z'),
    wait: async (delay) => { waits.push(delay); },
    fetcher: async (url, request) => {
      if (url === endpoint) {
        assert.equal(request.method, 'POST');
        assert.equal(request.redirect, 'manual');
        assert.equal(request.headers['Content-Type'], 'application/json; charset=utf-8');
        posts.push(JSON.parse(request.body));
        return overrides.status();
      }
      assert.equal(request.method, 'GET');
      gets.push(url);
      if (url === cloudflare) {
        assert.equal(request.headers.Authorization, 'Bearer test-read-token');
        return Response.json({ success: true, result: { name: 'map-embed-code', domains: ['map-embed-code.com'], canonical_deployment: production } });
      }
      assert.ok(url.startsWith(origin + '/'), 'Unexpected outside request ' + url);
      if (responses.has(url)) return responses.get(url)();
      if (url === keyLocation) return text(key);
      if (url === origin + '/robots.txt') return text('User-agent: *\nDisallow: /blocked/\n');
      return new Response(null, { status: 404 });
    },
    ...options,
  });
  const manifest = async () => JSON.parse(await readFile(path, 'utf8'));
  return { keyDirectory, path, env, posts, gets, waits, log, responses, listing, page, overrides, deployment, run, manifest };
}

test('uses a matching existing key, validates nested XML, and ignores alt links or image locations', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.keyDirectory, 'f'.repeat(32) + '.txt'), 'mismatched\n');
  assert.equal(await findKey(f.keyDirectory), key);
  assert.deepEqual(parseSitemap('<s:urlset xmlns:s="urn:s"><s:url><s:loc>https://map-embed-code.com/?a=1&amp;b=2</s:loc><image:image><image:loc>foo</image:loc></image:image></s:url></s:urlset>'),
    { kind: 'urls', locations: [origin + '/?a=1&b=2'] });
  assert.throws(() => parseSitemap('<urlset><url><loc>' + origin + '/</loc></url>'), /Malformed/);
  assert.throws(() => parseSitemap('<urlset><url><image:loc>' + origin + '/</image:loc></url></urlset>'), /Malformed/);
  assert.throws(() => parseSitemap('<!DOCTYPE urlset><urlset/>'), /Malformed/);
  const guide = origin + '/es/guides/';
  const nested = origin + '/sitemap-nested.xml';
  const compressed = origin + '/sitemap-1.xml.gz';
  f.responses.set(sitemapUrl, () => text(sitemapIndex([nested, compressed])));
  f.responses.set(nested, () => text(sitemapIndex([sitemapUrl, compressed])));
  f.responses.set(compressed, () => new Response(gzipSync(urlset([
    guide, guide, origin + '/blocked/guide/', origin + '/api/maps/',
    origin + '/es/map/id/', origin + '/embed/id/', origin + '/map-viewer/',
    origin + '/admin/', origin + '/guides/cover.webp', origin + '/guides/?q=x',
    'https://map-embed-code.pages.dev/', origin + '/noindex/', origin + '/noindex-header/', origin + '/not-canonical/',
    origin + '/private-page/',
  ]))));
  f.page(guide, 'Translated guide');
  f.page(origin + '/noindex/', 'Hidden', '1', '<meta name="robots" content="noindex">');
  f.page(origin + '/noindex-header/', 'Hidden', '1', '', { 'X-Robots-Tag': 'bingbot: noindex' });
  f.responses.set(origin + '/not-canonical/', () => text(html(guide, 'Duplicate'), 'text/html'));
  f.responses.set(origin + '/private-page/', () => new Response(null, { status: 401 }));
  const result = await f.run('all');
  assert.equal(result.discovered, 15);
  assert.equal(result.eligible, 1);
  assert.equal(result.skipped, 14);
  assert.deepEqual(f.posts, [{ host: 'map-embed-code.com', key, keyLocation, urlList: [guide] }]);
  assert.equal(f.gets.filter((url) => url === compressed).length, 1);
  assert.ok(!f.gets.includes(origin + '/api/maps/'));
});

test('ignores volatile output and submits new, edited, deleted, and permanently redirected URLs once', async (t) => {
  const f = await fixture(t);
  const [stable, updated, deleted, moved, unsitemapped, added] = ['stable', 'updated', 'old', 'moved', 'unlisted', 'new']
    .map((slug) => origin + '/guides/' + slug + '/');
  const originals = [stable, updated, deleted, moved, unsitemapped];
  f.listing(originals);
  for (const url of originals) f.page(url, 'Original');
  await f.run('all');
  const baseline = await f.manifest();
  assert.equal(baseline.ready, true);
  assert.equal(Object.keys(baseline.pages).length, originals.length);

  f.listing([stable, updated, added, moved]);
  f.page(stable, 'Original', '2');
  f.page(updated, 'Edited');
  f.page(added, 'New location guide');
  f.responses.set(deleted, () => new Response(null, { status: 410 }));
  f.responses.set(moved, () => new Response(null, { status: 308, headers: { Location: added } }));
  const result = await f.run('changed');
  assert.deepEqual(result, { discovered: 4, eligible: 3, added: 1, modified: 1, deleted: 2, skipped: 1, submitted: 4 });
  assert.deepEqual(f.posts.at(-1).urlList, [added, updated, moved, deleted]);
  const state = await f.manifest();
  assert.equal(state.pages[stable], baseline.pages[stable]);
  assert.equal(state.pages[unsitemapped], baseline.pages[unsitemapped]);
  assert.ok(!state.pages[deleted]);
  assert.equal((await f.run('changed')).submitted, 0);
  assert.equal(f.posts.length, 2);
});

test('checks and dry runs stay read-only and a live changed run requires an initial baseline', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.run('check')).submitted, 0);
  assert.equal((await f.run('changed', { dryRun: true })).added, 1);
  assert.ok(f.log.some((message) => message.includes('Dry run: 1 planned')));
  assert.ok(!f.gets.includes(cloudflare));
  await assert.rejects(f.run('changed'), /initial baseline/);
  await assert.rejects(f.manifest(), { code: 'ENOENT' });
  assert.equal(f.posts.length, 0);
});

test('requires the matching verified production deployment and live key before POST', async (t) => {
  const f = await fixture(t);
  f.deployment({ environment: 'preview' });
  await assert.rejects(f.run('all'), /no verified successful active production deployment/);
  f.deployment({ environment: 'production', id: 'another-release' });
  await assert.rejects(f.run('all'), /not the active production deployment/);
  f.deployment({ id: release });
  f.responses.set(keyLocation, () => text('wrong key'));
  await assert.rejects(f.run('all'), /production key file/);
  await assert.rejects(f.run('all', { env: { ...f.env, CF_PAGES: '1' } }), /does not submit from Cloudflare Pages builds/);
  await assert.rejects(f.run('all', { env: { ...f.env, CI: 'true', INDEXNOW_MANIFEST: undefined } }), /private, persistent manifest/);
  f.responses.delete(keyLocation);
  f.responses.set(origin + '/', () => {
    f.deployment({ id: 'deployment-changed-mid-scan' });
    return text(html(origin + '/', 'New deployment'), 'text/html');
  });
  await assert.rejects(f.run('all'), /not the active production deployment/);
  assert.equal(f.posts.length, 0);
  await assert.rejects(f.manifest(), { code: 'ENOENT' });
});

test('submits requested eligible URLs only and deduplicates them', async (t) => {
  const f = await fixture(t);
  const guide = origin + '/guides/';
  f.listing([origin + '/', guide]);
  f.page(guide, 'Guide index');
  await assert.rejects(f.run('urls', { urls: ['/map/id/'] }), /not a canonical, indexable production sitemap URL/);
  assert.equal((await f.run('urls', { urls: [guide, '/guides/'] })).submitted, 1);
  assert.deepEqual(f.posts[0].urlList, [guide]);
  const state = await f.manifest();
  assert.equal(state.ready, false);
  assert.deepEqual(Object.keys(state.pages), [guide]);
});

test('retries network failures, HTTP 429 and 5xx with Retry-After, and accepts HTTP 202', async (t) => {
  const f = await fixture(t);
  const sequence = [
    () => { throw new TypeError('connection reset'); },
    () => new Response(null, { status: 429, headers: { 'Retry-After': '2' } }),
    () => new Response(null, { status: 503, headers: { 'Retry-After': 'Wed, 25 Nov 2026 00:00:03 GMT' } }),
    () => new Response(null, { status: 202 }),
  ];
  f.overrides.status = () => sequence.shift()();
  assert.equal((await f.run('all')).submitted, 1);
  assert.deepEqual(f.waits, [500, 2000, 3000]);
  assert.equal(f.posts.length, 4);
  assert.ok(f.log.some((message) => message.includes('key validation pending')));
  assert.equal((await f.manifest()).ready, true);
});

test('permanent IndexNow errors and exhausted retries leave the previous manifest intact', async (t) => {
  const f = await fixture(t);
  await f.run('all');
  const baseline = await f.manifest();
  f.page(origin + '/', 'Edited');
  for (const status of [400, 403, 422, 429, 503]) {
    f.overrides.status = () => new Response(null, { status });
    const before = f.posts.length;
    await assert.rejects(f.run('changed'), new RegExp('IndexNow HTTP ' + status));
    assert.deepEqual(await f.manifest(), baseline);
    assert.equal(f.posts.length - before, status < 429 ? 1 : 4);
  }
  f.overrides.status = () => new Response(null, { status: 429, headers: { 'Retry-After': '3600' } });
  const before = f.posts.length;
  await assert.rejects(f.run('changed'), /Retry-After over 60 seconds/);
  assert.equal(f.posts.length - before, 1);
  assert.deepEqual(await f.manifest(), baseline);
});

test('checkpoints an accepted batch and only retries the remaining URL after a partial failure', async (t) => {
  const f = await fixture(t);
  const urls = Array.from({ length: 10_001 }, (_, index) => origin + '/guides/' + String(index).padStart(5, '0') + '/');
  f.listing(urls);
  for (const url of urls) f.page(url, 'Guide');
  f.overrides.status = () => new Response(null, { status: f.posts.length === 1 ? 200 : 400 });
  await assert.rejects(f.run('all'), /IndexNow HTTP 400/);
  assert.equal(Object.keys((await f.manifest()).pages).length, 10_000);
  assert.equal(f.posts[0].urlList.length, 10_000);
  f.overrides.status = () => new Response(null, { status: 200 });
  assert.equal((await f.run('changed')).submitted, 1);
  assert.deepEqual(f.posts.at(-1).urlList, [urls.at(-1)]);
  assert.equal(Object.keys((await f.manifest()).pages).length, 10_001);
});

test('rejects state paths under public output and aborts on a failed sitemap scan', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.run('all', { env: { ...f.env, INDEXNOW_MANIFEST: 'public/indexnow-manifest.json' } }), /outside public/);
  await f.run('all');
  const baseline = await f.manifest();
  f.responses.set(origin + '/sitemap-0.xml', () => text('<urlset><url><loc>' + origin + '/</loc>', 'text/xml'));
  await assert.rejects(f.run('changed'), /Malformed/);
  assert.equal(f.posts.length, 1);
  assert.deepEqual(await f.manifest(), baseline);
});

test('keeps batches at 10,000 and rejects non-editorial or noncanonical URLs', () => {
  const urls = Array.from({ length: 10_001 }, (_, index) => origin + '/guides/' + index + '/');
  assert.deepEqual([...batches([...urls, urls[0]])].map((batch) => batch.length), [10_000, 1]);
  for (const url of [
    'http://map-embed-code.com/', 'https://map-embed-code.com.evil.test/', '//preview.pages.dev/',
    '/guides/?', '/guides/#', '/admin/', '/es/private/', '/es/embed/example/', '/map-viewer/',
    '/de/map/id/', '/api/maps/', '/guides/data.xml', '/guides/%2e%2e/private/', '/%61dmin/', origin + '//',
  ]) assert.equal(editorialUrl(url), null, url);
  assert.equal(editorialUrl('/es/pa%C3%ADses/'), origin + '/es/pa%C3%ADses/');
  const url = origin + '/guides/';
  const old = html(url, 'Content', 'one');
  assert.equal(pageFingerprint(old, url).hash, pageFingerprint(html(url, 'Content', 'two'), url).hash);
  assert.notEqual(pageFingerprint(old, url).hash, pageFingerprint(old.replace('<a href="/guides/">', '<a href="/changed/">'), url).hash);
  assert.equal(pageFingerprint(html(origin + '/another/', 'Duplicate'), url).reason, 'not self-canonical');
});
