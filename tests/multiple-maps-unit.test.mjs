import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// Use the same TypeScript bundler that Wrangler uses to test the source modules directly.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { build } = wranglerRequire('esbuild');
const result = await build({
  stdin: {
    contents: `export { photonEndpoint, boundedLimit } from './functions/_shared/photon';
      export { csvRows, validateRow } from './src/lib/multiple-maps/imports';
      export { settingsSchema, STYLES } from './src/lib/multiple-maps/schema';`,
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
});
const { photonEndpoint, boundedLimit, csvRows, validateRow, settingsSchema, STYLES } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);

test('Photon configuration stays on the authorized HTTPS origin and /api path', () => {
  assert.equal(photonEndpoint('https://search.example.org/').href, 'https://search.example.org/api');
  for (const rejected of [undefined, 'https://photon.komoot.io', 'http://search.example.org', 'https://127.0.0.1', 'https://test.local', 'https://[::1]', 'https://search.example.org#x', 'https://search.example.org/?x=1', 'https://search.example.org/reverse', 'https://user:pass@search.example.org']) {
    assert.equal(photonEndpoint(rejected), undefined);
  }
  assert.equal(boundedLimit('9000', 1000, 5000), 5000);
  assert.equal(boundedLimit('0', 1000, 5000), 1000);
});

test('CSV accepts both coordinate headers, preserves hex colors, and reports invalid coordinates', async () => {
  const [short, legacy] = await Promise.all([
    csvRows('title,address,lat,lon,description,color\nDelhi,New Delhi India,28.6139,77.2090,Capital,#e63946'),
    csvRows('title,address,latitude,longitude,description,color\nDelhi,New Delhi India,28.6139,77.2090,Capital,#e63946'),
  ]);
  assert.deepEqual(short, legacy);
  assert.equal(validateRow(short[0]).marker.color, '#e63946');
  assert.equal(validateRow(short[0]).marker.lng, 77.2090);
  assert.ok(validateRow({ ...short[0], longitude: '500' }).issue);
  assert.ok(validateRow({ ...short[0], color: 'url(https://example.org)' }).issue);
});

test('saved style IDs still validate and map to their supported OpenFreeMap equivalents', () => {
  assert.deepEqual(STYLES, { streets: 'liberty', bright: 'bright', light: 'positron', dark: 'dark' });
  for (const style of ['streets', 'light', 'dark']) assert.equal(settingsSchema.parse({ style }).style, style);
});
