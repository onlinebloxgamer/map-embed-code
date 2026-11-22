import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { chromium } from 'playwright';

const dist = resolve('dist');
const workerDir = resolve('.wrangler/maps-test');
const migration = readFileSync('migrations/0001_multiple_location_maps.sql', 'utf8');
const toolHeaders = readFileSync('public/_headers', 'utf8').match(/^\s*Content-Security-Policy: (.+)$/m)[1];
const marker = { title: 'Museum', lat: 40.67, lng: -73.96, description: '<img src=x onerror=alert(1)>', website: 'https://example.org/' };
const draft = { title: 'Test map', markers: [marker], settings: {} };
const tool = '/multiple-location-map-generator/';
const styleHost = 'https://tiles.openfreemap.org';
const fixtureStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e3ede6' } }] };
const styleRequests = [];
let photonRequests = 0;
const outboundRequests = [];
let mf;
let base;
let browser;
let created;

function assets(request) {
  const pathname = new URL(request.url).pathname;
  const filename = resolve(dist, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
  if (!filename.startsWith(`${dist}${sep}`) || !existsSync(filename)) return new Response('Asset unavailable', { status: 404 });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.xml': 'application/xml', '.webp': 'image/webp' };
  const headers = { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream' };
  if (pathname === tool) headers['Content-Security-Policy'] = toolHeaders;
  return new Response(readFileSync(filename), { headers });
}

async function provider(request) {
  const url = new URL(request.url);
  outboundRequests.push(`${url.hostname}${url.pathname}`);
  if (url.hostname === 'challenges.cloudflare.com' && url.pathname === '/turnstile/v0/siteverify') {
    const token = new URLSearchParams(await request.text()).get('response');
    return Response.json({ success: ['publish-map', 'geocode'].includes(token), hostname: 'localhost', action: token });
  }
  if (url.hostname === 'photon.example.org' && url.pathname === '/api') {
    photonRequests++;
    assert.equal(url.searchParams.get('limit'), '5');
    const query = url.searchParams.get('q');
    if (query.startsWith('Busy')) return new Response(null, { status: 429 });
    if (query.startsWith('Broken')) return new Response(null, { status: 503 });
    if (query.startsWith('Redirect')) return new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example.org/api' } });
    const features = query.startsWith('Unknown') ? [] : [{
      type: 'Feature', geometry: { type: 'Point', coordinates: [-73.9636, 40.6712] },
      properties: { name: 'Brooklyn Museum', street: 'Eastern Parkway', housenumber: '200', city: 'Brooklyn', state: 'NY' },
    }];
    return Response.json({ type: 'FeatureCollection', features });
  }
  return new Response('Unexpected outgoing request', { status: 502 });
}

function workerOptions(overrides = {}) {
  return convertV4MiniflareOptions({
    modules: true, scriptPath: join(workerDir, 'index.js'), compatibilityDate: '2025-09-01', outboundService: provider,
    serviceBindings: { ASSETS: assets }, d1Databases: { MAPS_DB: 'maps-test' },
    bindings: {
      PHOTON_BASE_URL: 'https://photon.example.org', PHOTON_ALLOW_AUTOCOMPLETE: 'true', PHOTON_ALLOW_BULK: 'true', PHOTON_REQUESTS_PER_SECOND: '10',
      TURNSTILE_SITE_KEY: 'fixture-site-key', TURNSTILE_SECRET_KEY: 'fixture-secret', TURNSTILE_HOSTNAME: 'localhost',
      MAP_SESSION_SECRET: 'a'.repeat(64), ...overrides,
    },
  });
}

async function mockTiles(page) {
  await page.route(`${styleHost}/styles/*`, (route) => {
    styleRequests.push(route.request().url());
    return route.fulfill({ json: fixtureStyle, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
}

async function browserForMaps() {
  if (!browser) {
    const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const chrome = process.env.MAP_TEST_CHROME || (process.platform === 'win32' && existsSync(installedChrome) ? installedChrome : undefined);
    browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  }
  return browser;
}

before(async () => {
  mkdirSync('.wrangler', { recursive: true });
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'functions', 'build', '--outdir', workerDir], {
    encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: resolve('.wrangler/wrangler-test.log') },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  mf = new Miniflare(workerOptions());
  base = new URL(await mf.ready);
  const db = await mf.getD1Database('MAPS_DB');
  await db.batch(migration.split(';').map((line) => line.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
});

after(async () => {
  await browser?.close();
  await mf?.dispose();
});

function request(route, method = 'GET', body, options = {}) {
  const headers = new Headers(options.headers);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const url = new URL(route, base);
  return fetch(url, { method, headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

test('map API validates input, saves to D1, keeps credentials private, and authorizes edits and deletion', async () => {
  const create = (configuration, verification = 'publish-map') => request('/api/maps', 'POST', { configuration, verification });
  assert.equal((await request('/api/maps', 'POST', '{ malformed')).status, 400);
  assert.equal((await request('/api/maps', 'POST', '"' + 'x'.repeat(270000) + '"')).status, 413);
  assert.equal((await create({ ...draft, markers: [{ ...marker, lat: 95 }] })).status, 422);
  assert.equal((await create({ ...draft, markers: [{ ...marker, website: 'javascript:alert(1)' }] })).status, 422);
  assert.equal((await create({ ...draft, markers: Array(21).fill(marker) })).status, 422);
  assert.equal((await create(draft, 'invalid')).status, 403);
  const response = await create(draft);
  assert.equal(response.status, 201, await response.clone().text());
  created = await response.json();
  assert.match(created.id, /^[a-f0-9]{32}$/);
  assert.match(created.token, /^[a-f0-9]{64}$/);
  const path = `/api/maps/${created.id}`;
  const publicMap = await request(path);
  assert.match(publicMap.headers.get('Cache-Control'), /s-maxage=60/);
  const data = await publicMap.json();
  assert.deepEqual(Object.keys(data).sort(), ['configuration', 'id']);
  assert.equal(data.configuration.markers[0].description, marker.description);
  const db = await mf.getD1Database('MAPS_DB');
  const row = await db.prepare('SELECT edit_token_hash FROM maps WHERE id = ?').bind(created.id).first();
  assert.notEqual(row.edit_token_hash, created.token);
  assert.equal((await request(path, 'DELETE')).status, 401);
  assert.equal((await request(path, 'PATCH', draft, { headers: { Authorization: `Bearer ${'b'.repeat(64)}` } })).status, 403);
  assert.equal((await request(path, 'DELETE', undefined, { headers: { Authorization: `Bearer ${'b'.repeat(64)}` } })).status, 403);
  const headers = { Authorization: `Bearer ${created.token}` };
  assert.equal((await request(path, 'PATCH', { ...draft, title: 'Updated map' }, { headers })).status, 200);
  const recovery = await request('/api/map-tool/recover', 'POST', { id: created.id }, { headers });
  assert.equal((await recovery.json()).configuration.title, 'Updated map');
  const embed = await request(`/embed/${created.id}`);
  assert.equal(embed.status, 200);
  assert.match(embed.headers.get('Content-Security-Policy'), /frame-ancestors \*/);
  assert.match(embed.headers.get('X-Robots-Tag'), /noindex/);
  const embedHtml = await embed.text();
  assert.doesNotMatch(embedHtml, /googletagmanager|Map Embed Code.{0,20}<\/a>|<img src=x/);
  assert.ok(embedHtml.includes('\\u003cimg src=x'));
  assert.ok(!embedHtml.includes(created.token));
  assert.equal((await request(path, 'DELETE', undefined, { headers })).status, 204);
  assert.equal((await request(path)).status, 404);
  assert.equal((await request(`/embed/${created.id}`)).status, 404);
});

test('geocode requires verification, validates inputs, caches resolved searches, and rate-limits repeated use', async () => {
  const geocode = (query, headers = {}) => request('/api/geocode', 'POST', { query, mode: 'search' }, { headers });
  assert.equal((await geocode('Museum')).status, 403);
  assert.equal((await geocode('x')).status, 422);
  const network = { 'CF-Connecting-IP': '192.0.2.7' };
  const session = await request('/api/map-tool/session', 'POST', { verification: 'geocode' }, { headers: network });
  assert.equal(session.status, 200, await session.clone().text());
  const headers = { ...network, 'X-Geocode-Session': (await session.json()).session };
  const match = await geocode('Museum', headers);
  assert.equal(match.status, 200, `${await match.clone().text()} (upstream calls ${photonRequests}, ${outboundRequests.join(', ')})`);
  assert.equal((await match.json()).results[0].title, 'Brooklyn Museum');
  assert.deepEqual((await (await geocode('Unknown', headers)).json()).results, []);
  assert.equal((await geocode('Busy provider', headers)).status, 429);
  assert.equal((await geocode('Broken provider', headers)).status, 503);
  assert.equal((await geocode('Redirected provider', headers)).status, 503);
  assert.ok(!outboundRequests.some((url) => url.startsWith('elsewhere.example.org')));
  const db = await mf.getD1Database('MAPS_DB');
  assert.ok((await db.prepare('SELECT count(*) AS total FROM map_geocodes').first()).total > 0);
  await db.prepare("UPDATE map_rate_limits SET count = 29, window = (unixepoch() / 60) * 60 WHERE key LIKE 'geocode:%'").run();
  assert.equal((await geocode('Museum', headers)).status, 200);
  assert.equal((await geocode('Museum', headers)).status, 429);
});

test('configured Photon endpoints enable search while optional modes require explicit opt-in', async () => {
  for (const [endpoint, enabled] of [['', false], ['https://photon.komoot.io', true], ['https://photon.example.org', true]]) {
    const local = new Miniflare(workerOptions({ PHOTON_BASE_URL: endpoint, PHOTON_ALLOW_AUTOCOMPLETE: 'false', PHOTON_ALLOW_BULK: 'false' }));
    try {
      const testOrigin = await local.ready;
      const response = await fetch(new URL('/api/map-tool/config', testOrigin));
      const config = await response.json();
      assert.deepEqual([config.geocoding, config.geocodeAutocomplete, config.geocodeBulk], [enabled, false, false]);
      assert.ok(!('tileKey' in config));
      for (const mode of ['autocomplete', 'bulk']) {
        const refused = await local.dispatchFetch(new URL('/api/geocode', testOrigin), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'Brooklyn', mode }),
        });
        assert.equal(refused.status, enabled ? 403 : 503);
      }
    } finally { await local.dispose(); }
  }
});

test('static SEO routes are unique, indexed, internally linked, and preserve the Google Maps workflow', async () => {
  const routes = [tool, '/create-map-with-multiple-pins/', '/custom-map-with-multiple-pins/', '/guides/how-to-create-map-with-multiple-pins/', '/guides/how-to-map-multiple-locations/'];
  const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
  const titles = new Set();
  const descriptions = new Set();
  for (const route of routes) {
    const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    descriptions.add(html.match(/<meta name="description" content="([^"]+)"/)[1]);
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
    assert.ok(html.includes(`rel="canonical" href="https://map-embed-code.com${route}"`));
    assert.ok(html.includes('href="/multiple-location-map-generator/'));
    assert.ok(sitemap.includes(`https://map-embed-code.com${route}`));
  }
  assert.equal(titles.size, routes.length);
  assert.equal(descriptions.size, routes.length);
  assert.doesNotMatch(sitemap, /\/map-viewer|\/embed\/|\/map\//);
  for (const screenshot of ['native-multiple-map-editor.webp', 'native-multiple-map-marker-editor.webp']) {
    assert.ok(existsSync(join(dist, 'guides', screenshot)), 'Missing tutorial screenshot ' + screenshot);
  }
  for (const route of ['/', '/es/', '/de/']) {
    const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
    assert.match(html, /maps\.google\.com/);
    assert.doesNotMatch(html, /leaflet-|maplibre|openfreemap/i);
  }
});

test('editor and viewer work in a browser, including mobile layout and a cross-origin iframe', async () => {
  await browserForMaps();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(15000);
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', (route) => route.fulfill({
    contentType: 'application/javascript', body: 'window.turnstile = { render(_el, opts) { setTimeout(() => opts.callback(opts.action), 50); return "fixture"; }, remove() {} };',
  }));
  await mockTiles(page);
  await page.route(/https:\/\/(fonts\.|www\.googletagmanager|www\.google-analytics)/, (route) => route.abort());
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto(new URL(tool, base).href);
  await page.locator('#mm-canvas.maplibregl-map canvas').waitFor();
  await page.getByRole('link', { name: 'OpenFreeMap', exact: true }).waitFor();
  assert.ok(styleRequests.includes(`${styleHost}/styles/liberty`));
  await page.getByRole('button', { name: 'Enter Coordinates' }).click();
  const editor = page.locator('#mm-marker-dialog');
  await editor.getByLabel('Location title').fill('Coordinate pin');
  await editor.getByLabel('Latitude').fill('40.69');
  await editor.getByLabel('Longitude').fill('-73.99');
  await editor.getByLabel('Description').fill('<img src=x onerror=alert(1)>');
  await editor.locator('select[name=color]').selectOption('purple');
  await editor.getByRole('button', { name: 'Save Location' }).click();
  await page.getByRole('button', { name: 'Fit All Locations' }).click();
  await page.getByRole('button', { name: 'Show Coordinate pin on the map' }).click();
  await page.locator('.maplibregl-popup-content').getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
  assert.equal(await page.locator('.maplibregl-popup-content img').count(), 0);
  await page.locator('.maplibregl-popup-close-button').click();
  const pin = page.locator('.mm-map-marker').first();
  await pin.scrollIntoViewIfNeeded();
  const bounds = await pin.boundingBox();
  assert.ok(bounds);
  await page.mouse.move(bounds.x + 15, bounds.y + 15);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 65, bounds.y + 40, { steps: 10 });
  await page.mouse.up();
  await page.getByText('Moved Coordinate pin.').waitFor();
  await page.getByRole('button', { name: 'Edit Coordinate pin' }).click();
  await editor.getByLabel('Description').fill('Updated marker description');
  await editor.getByRole('button', { name: 'Save Location' }).click();
  await page.getByRole('button', { name: 'Add Pin on Map' }).click();
  await page.locator('#mm-canvas').click({ position: { x: 360, y: 285 } });
  await editor.getByLabel('Location title').fill('Map click pin');
  await editor.getByRole('button', { name: 'Save Location' }).click();
  await page.getByRole('button', { name: 'Move Map click pin up' }).click();
  await page.getByRole('button', { name: 'Delete Map click pin' }).click();
  await page.getByLabel('Search locations').fill('Brooklyn Museum');
  await page.getByRole('button', { name: 'Add Location', exact: true }).click();
  await page.getByRole('button', { name: 'Add Brooklyn Museum, 200 Eastern Parkway, Brooklyn, NY' }).click();
  await page.getByLabel('Search locations').fill('Brooklyn Mu');
  await page.getByRole('button', { name: 'Add Brooklyn Museum, 200 Eastern Parkway, Brooklyn, NY' }).waitFor();
  await page.getByLabel('Search locations').press('Escape');
  await page.getByRole('button', { name: 'Add Multiple Locations', exact: true }).click();
  const importer = page.locator('#mm-import-dialog');
  await importer.getByLabel('One address per line').fill('Brooklyn Museum | Group visit\nUnknown address');
  await importer.getByRole('button', { name: 'Preview Locations' }).click();
  await importer.getByRole('button', { name: 'Add Locations', exact: true }).click();
  await importer.getByText(/1 added.*1 still need attention/).waitFor();
  await importer.getByText('Edit this row').click();
  await importer.getByLabel('Address', { exact: true }).fill('Brooklyn Museum, NY');
  await importer.getByRole('button', { name: 'Add or Retry Remaining Locations' }).click();
  await importer.getByText(/All locations are on the map/).waitFor();
  await importer.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  await importer.locator('input[type=file]').setInputFiles(join('public', 'examples', 'multiple-map-locations.csv'));
  await importer.getByRole('button', { name: 'Preview Locations' }).click();
  await importer.getByText(/3 locations ready to review/).waitFor();
  const beforeCsv = photonRequests;
  await importer.getByRole('button', { name: 'Add Locations', exact: true }).click();
  await importer.getByText(/3 added/).waitFor();
  assert.equal(photonRequests, beforeCsv);
  await importer.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Edit Delhi' }).click();
  assert.equal(await editor.locator('input[type=color]').inputValue(), '#e63946');
  await editor.getByLabel('Marker icon').selectOption('circle');
  await editor.getByRole('button', { name: 'Save Location' }).click();
  await page.locator('#mm-settings-panel summary').click();
  await page.getByLabel('Fit markers on load').uncheck();
  await page.getByLabel('Default zoom').fill('2');
  await page.getByLabel('Default zoom').press('Tab');
  const grouped = page.getByRole('button', { name: /Zoom to \d+ grouped locations/ }).first();
  await grouped.waitFor();
  await grouped.press('Enter');
  for (const [value, style] of [['bright', 'bright'], ['light', 'positron']]) {
    await Promise.all([
      page.waitForResponse((response) => response.url() === `${styleHost}/styles/${style}`),
      page.getByLabel('Map style').selectOption(value),
    ]);
  }
  const allStyles = [`${styleHost}/styles/liberty`, `${styleHost}/styles/bright`, `${styleHost}/styles/positron`];
  for (const expected of allStyles) {
    for (let attempt = 0; !styleRequests.includes(expected) && attempt < 25; attempt++) await new Promise((done) => setTimeout(done, 60));
    assert.ok(styleRequests.includes(expected), expected);
  }
  await page.getByRole('button', { name: 'Generate Map & Embed Code' }).click();
  await page.getByText(/Map saved/).waitFor();
  const url = await page.getByLabel('Shareable map URL').inputValue();
  const code = await page.getByLabel('HTML iframe').inputValue();
  assert.match(code, /width="100%"/);
  const startDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Recovery File' }).click();
  const recoveryPath = await (await startDownload).path();
  await page.reload();
  await page.locator('#mm-canvas.maplibregl-map canvas').waitFor();
  await page.locator('#mm-recovery-file').setInputFiles({ name: 'recovery.json', mimeType: 'application/json', buffer: readFileSync(recoveryPath) });
  await page.getByText(/Map opened for editing/).waitFor();
  await page.getByLabel('Map title').fill('Recovered map');
  await page.getByRole('button', { name: 'Save Map Changes' }).click();
  await page.getByText(/Map saved/).waitFor();
  const shared = await browser.newPage({ viewport: { width: 390, height: 844 } });
  shared.setDefaultTimeout(15000);
  await mockTiles(shared);
  await shared.goto(url);
  await shared.getByRole('heading', { name: 'Recovered map' }).waitFor();
  if (process.env.MAP_CAPTURE_SCREENSHOTS === '1' || !existsSync('.wrangler/migrated-map-editor.png')) {
    const capture = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    await capture.route('**/api/map-tool/config', (route) => route.fulfill({ json: { markerLimit: 20, turnstileSiteKey: '', geocoding: false } }));
    await capture.route(/https:\/\/(fonts\.|www\.googletagmanager|www\.google-analytics)/, (route) => route.abort());
    await mockTiles(capture);
    await capture.goto(new URL(`${tool}?example=nyc`, base).href);
    await capture.locator('#mm-canvas.maplibregl-map .mm-map-marker').first().waitFor();
    await capture.locator('.mm-workspace').screenshot({ path: '.wrangler/migrated-map-editor.png', animations: 'disabled' });
    await capture.getByRole('button', { name: 'Edit Central Park' }).click();
    await capture.locator('#mm-marker-dialog').screenshot({ path: '.wrangler/migrated-marker-editor.png', animations: 'disabled' });
    await capture.close();
  }
  const host = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">${code}`);
  });
  await new Promise((done) => host.listen(0, '127.0.0.1', done));
  try {
    const thirdParty = `http://127.0.0.1:${host.address().port}`;
    assert.notEqual(new URL(url).origin, thirdParty);
    await shared.goto(thirdParty);
    const embedded = shared.frameLocator('iframe');
    await embedded.locator('#viewer.maplibregl-map canvas').waitFor();
    await embedded.getByRole('link', { name: 'OpenFreeMap', exact: true }).waitFor();
    assert.equal(await embedded.locator('.mm-cluster-count').count(), 0);
    await embedded.locator('.mm-map-marker:not([hidden])').first().click();
    await embedded.locator('.maplibregl-popup-content').waitFor();
  } finally { await new Promise((done) => host.close(done)); }
  await page.getByRole('button', { name: 'Delete Saved Map' }).click();
  await page.getByText(/Map deleted/).waitFor();
  await shared.goto(url);
  await shared.getByText(/This map is unavailable/).waitFor();
  await shared.route('**/api/map-tool/config', (route) => route.fulfill({ json: { markerLimit: 20, turnstileSiteKey: '', geocoding: false } }));
  await shared.goto(new URL(tool, base).href);
  await shared.locator('#mm-canvas.maplibregl-map canvas').waitFor();
  assert.equal(await shared.evaluate(() => document.documentElement.scrollWidth), 390);
  const paused = shared.locator('#mm-import-dialog');
  const beforeFallback = photonRequests;
  await shared.getByRole('button', { name: 'Add Multiple Locations', exact: true }).click();
  await paused.getByLabel('One address per line').fill('New Delhi, India');
  await paused.getByRole('button', { name: 'Preview Locations' }).click();
  await paused.getByRole('button', { name: 'Add Locations', exact: true }).click();
  await paused.getByText(/Bulk address lookup is unavailable. Enter latitude/).waitFor();
  await paused.getByText('Edit this row').click();
  await paused.getByLabel('Latitude').fill('28.6139');
  await paused.getByLabel('Longitude').fill('77.2090');
  await paused.getByRole('button', { name: 'Add or Retry Remaining Locations' }).click();
  await paused.getByText(/1 added/).waitFor();
  assert.equal(photonRequests, beforeFallback);
  await shared.goto(new URL('/', base).href);
  await shared.getByRole('button', { name: 'Generate Code', exact: true }).click();
  assert.match(await shared.locator('#embed-code-output').textContent(), /<iframe[\s\S]*maps\.google\.com/);
});

test('saved Delhi map fits four distinct clickable badges in the share page and iframes', async () => {
  const id = 'bf42a30a15a684b5ea0a729318b6aefa';
  const locations = [
    { title: 'ESIC Model Hospital', lat: 28.6572872, lng: 77.1290898, color: 'green' },
    { title: "Metro Hospital and Heart Institute's Blood Bank", lat: 28.5974385, lng: 77.3379625, color: 'yellow' },
    { title: 'Adobe Systems India', lat: 28.5888039, lng: 77.344616, color: 'red' },
    { title: 'Pari Chowk', lat: 28.4631285, lng: 77.5080985, color: 'purple' },
  ];
  const configuration = { title: 'Noida Hospitals group', description: 'Hospital of Noida', markers: locations, settings: { fit: true, zoom: 12 } };
  const db = await mf.getD1Database('MAPS_DB');
  await db.prepare('INSERT INTO maps (id, title, description, configuration, edit_token_hash) VALUES (?, ?, ?, ?, ?)')
    .bind(id, configuration.title, configuration.description, JSON.stringify(configuration), 'fixture').run();
  const page = await (await browserForMaps()).newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockTiles(page);

  async function markerBounds(view) {
    const badges = view.locator('#viewer .mm-map-marker .mm-pin');
    await badges.last().waitFor({ state: 'visible' });
    return badges.evaluateAll(async (markers) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = document.querySelector('#viewer').getBoundingClientRect();
      return markers.map((badge) => {
        const rect = badge.getBoundingClientRect();
        return {
          number: badge.textContent, visible: badge.checkVisibility(),
          left: rect.left - canvas.left, right: rect.right - canvas.left,
          top: rect.top - canvas.top, bottom: rect.bottom - canvas.top,
          width: canvas.width, height: canvas.height,
        };
      });
    });
  }

  async function assertFit(view, viewport) {
    const positions = await markerBounds(view);
    assert.deepEqual(positions.map(({ number }) => number), ['1', '2', '3', '4']);
    assert.equal(await view.locator('#viewer .mm-cluster-count').count(), 0);
    for (const [index, badge] of positions.entries()) {
      assert.ok(badge.visible && Math.min(badge.left, badge.width - badge.right, badge.top, badge.height - badge.bottom) > 0, `${viewport}: ${JSON.stringify(badge)}`);
      for (const other of positions.slice(index + 1)) {
        assert.ok(badge.right <= other.left || other.right <= badge.left || badge.bottom <= other.top || other.bottom <= badge.top,
          `${viewport}: badges ${badge.number} and ${other.number} overlap`);
      }
    }
    return positions.map(({ left, top }) => [left, top]);
  }

  async function checkPopups(view) {
    for (const { title } of locations) {
      await view.getByRole('button', { name: `Open ${title}`, exact: true }).click();
      await view.locator('.maplibregl-popup-content').getByText(title, { exact: true }).waitFor();
      await view.locator('.maplibregl-popup-close-button').click();
    }
  }

  try {
    for (const [width, height] of [[1366, 768], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(new URL(`/map/${id}`, base).href);
      await assertFit(page, `share ${width} × ${height}`);
    }
    await checkPopups(page);
    const buttons = page.getByRole('list', { name: 'Map locations' });
    for (const { title } of locations) {
      await buttons.getByRole('button', { name: title, exact: true }).click();
      await page.locator('.maplibregl-popup-content').getByText(title, { exact: true }).waitFor();
      await page.getByRole('button', { name: `Open ${title}`, exact: true }).waitFor();
    }
    await page.setViewportSize({ width: 420, height: 844 });
    await markerBounds(page);
    await page.locator('.maplibregl-popup-content').getByText('Pari Chowk', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fit All Locations' }).click();
    await assertFit(page, 'share after focusing a location');

    for (const [width, cssWidth, height] of [[1100, '100%', 450], [768, '600px', 450], [390, '350px', 300]]) {
      await page.setViewportSize({ width, height: 800 });
      const shell = new URL('/viewer-regression', base).href;
      await page.route(shell, (route) => route.fulfill({
        contentType: 'text/html',
        body: `<meta name="viewport" content="width=device-width, initial-scale=1"><iframe style="display:block;width:${cssWidth};height:${height}px;border:0" src="/embed/${id}"></iframe>`,
      }));
      await page.goto(shell);
      const embedded = page.frameLocator('iframe');
      const initial = await assertFit(embedded, `iframe ${cssWidth} × ${height}px`);
      const frame = await page.locator('iframe').boundingBox();
      const canvas = await embedded.locator('#viewer').boundingBox();
      assert.equal(canvas.width, frame.width);
      assert.equal(canvas.height, height);
      if (height === 300) {
        await embedded.locator('.mm-marker-leader:visible').first().waitFor();
        await checkPopups(embedded);
        const picker = embedded.getByLabel('Go to a location');
        for (const index of [1, 2]) {
          await picker.selectOption(String(index));
          await embedded.locator('.maplibregl-popup-content').getByText(locations[index].title, { exact: true }).waitFor();
        }
        await embedded.locator('.maplibregl-popup-close-button').click();
        const zoomIn = embedded.getByRole('button', { name: 'Zoom in', exact: true });
        for (let i = 0; i < 3; i++) await zoomIn.click();
        const zoomed = (await markerBounds(embedded)).slice(1, 3);
        assert.ok(zoomed.every((badge) => badge.left > 0 && badge.right < badge.width && badge.top > 0 && badge.bottom < badge.height));
        for (const index of [1, 2]) {
          const pin = embedded.getByRole('button', { name: `Open ${locations[index].title}`, exact: true });
          await pin.locator('.mm-marker-leader').waitFor({ state: 'hidden' });
        }
        await embedded.getByRole('button', { name: 'Fit All Locations' }).click();
        assert.deepEqual(await assertFit(embedded, 'iframe after zooming'), initial);
      }
      await page.unroute(shell);
    }
    const saved = await db.prepare('SELECT configuration FROM maps WHERE id = ?').bind(id).first();
    assert.deepEqual(JSON.parse(saved.configuration), configuration);
  } finally { await page.close(); }
});
