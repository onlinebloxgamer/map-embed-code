import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { editorialUrl, endpoint, origin, pageFingerprint, parseSitemap, robotsRules, sitemapUrl } from './indexnow-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = new URL(origin).hostname;
const project = 'map-embed-code';
const hexKey = /^[a-f0-9]{32}$/i;
const sha256 = /^[a-f0-9]{64}$/;
const xmlLimit = 50 * 1024 * 1024;
const htmlLimit = 5 * 1024 * 1024;
const maxBatchSize = 10_000;
const maxAttempts = 4;
const maxDelay = 60_000;

export async function findKey(directory = resolve(root, 'public')) {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.txt') && hexKey.test(name.slice(0, -4)));
  const keys = [];
  for (const filename of files) {
    const path = resolve(directory, filename);
    if (!(await stat(path)).isFile()) continue;
    const key = filename.slice(0, -4);
    if ((await readFile(path, 'utf8')).trim() === key) keys.push(key);
  }
  if (keys.length !== 1) throw new Error('Expected exactly one valid public/{key}.txt file with a matching 32-character key.');
  return keys[0];
}

function retryAfter(value, now) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - now());
}

class ResponseTooLarge extends Error {}
async function readBytes(response, limit) {
  const chunks = [];
  let size = 0;
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new ResponseTooLarge('Response exceeded the configured byte limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function httpClient({ fetcher, wait, now, log }) {
  return async (url, { method = 'GET', headers = {}, body, limit = 0 } = {}) => {
    const label = method + ' ' + url;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let retry;
      let delay = 500 * 2 ** attempt;
      try {
        const response = await fetcher(url, {
          method, body, headers: { 'Cache-Control': 'no-cache', ...headers },
          redirect: 'manual', signal: AbortSignal.timeout(15_000),
        });
        const { status } = response;
        if (status === 429 || status >= 500) {
          retry = 'HTTP ' + status;
          delay = Math.max(delay, retryAfter(response.headers.get('Retry-After'), now));
        }
        const bytes = status === 200 && limit ? await readBytes(response, limit) : null;
        if (!bytes) await response.body?.cancel().catch(() => {});
        if (!retry || attempt === maxAttempts - 1) return { status, headers: response.headers, bytes };
      } catch (error) {
        if (error instanceof ResponseTooLarge) throw new Error(label + ': ' + error.message);
        if (attempt === maxAttempts - 1) throw new Error(label + ' failed after ' + maxAttempts + ' attempts: ' + error.message);
        retry = 'network failure';
      }
      if (delay > maxDelay) throw new Error(label + ' returned ' + retry + ' with Retry-After over 60 seconds. Retry later.');
      log(label + ' returned ' + retry + '. Retrying in ' + delay + ' ms.');
      await wait(delay);
    }
  };
}

async function verifyKey(request, key) {
  const location = origin + '/' + key + '.txt';
  const response = await request(location, { limit: 1024 });
  if (response.status !== 200 || !/^text\/plain\b/i.test(response.headers.get('Content-Type') ?? '')
    || response.bytes.toString('utf8').trim() !== key) {
    throw new Error('The production key file must return HTTP 200 and the exact key as text/plain at ' + location);
  }
  return location;
}

async function discover(request) {
  const sitemaps = new Set([sitemapUrl]);
  const locations = [];
  for (const url of sitemaps) {
    const response = await request(url, { limit: xmlLimit });
    if (response.status !== 200) throw new Error('Sitemap ' + url + ' returned HTTP ' + response.status);
    const compressed = response.bytes[0] === 0x1f && response.bytes[1] === 0x8b;
    const xml = compressed ? gunzipSync(response.bytes, { maxOutputLength: xmlLimit }) : response.bytes;
    const sitemap = parseSitemap(xml.toString('utf8'));
    if (sitemap.kind === 'urls') {
      if (locations.length + sitemap.locations.length > 250_000) throw new Error('Sitemap traversal exceeded 250,000 URL entries.');
      for (const location of sitemap.locations) locations.push(location);
      continue;
    }
    for (const location of sitemap.locations) {
      const child = new URL(location);
      if (child.origin !== origin || child.href !== location || child.username || child.password
        || /[?#]/.test(location) || !/\.xml(?:\.gz)?$/i.test(child.pathname)) {
        throw new Error('Sitemap child is not an absolute XML URL on the production host: ' + location);
      }
      sitemaps.add(child.href);
      if (sitemaps.size > 128) throw new Error('Sitemap traversal exceeded 128 files.');
    }
  }
  if (!locations.length) throw new Error('The production sitemap tree contains no URLs. No deletions will be inferred.');
  return { locations, files: sitemaps.size };
}

async function activeDeployment(request, env) {
  if (!hexKey.test(env.CLOUDFLARE_ACCOUNT_ID ?? '') || !env.CLOUDFLARE_INDEXNOW_TOKEN) {
    throw new Error('Set CLOUDFLARE_ACCOUNT_ID and a Pages Read CLOUDFLARE_INDEXNOW_TOKEN for live submissions.');
  }
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + env.CLOUDFLARE_ACCOUNT_ID + '/pages/projects/' + project;
  const response = await request(url, {
    headers: { Authorization: 'Bearer ' + env.CLOUDFLARE_INDEXNOW_TOKEN }, limit: 4 * 1024 * 1024,
  });
  if (response.status !== 200) throw new Error('Cloudflare Pages deployment verification returned HTTP ' + response.status + '. Check account and token permissions.');
  const { success, result } = JSON.parse(response.bytes.toString('utf8'));
  const deployment = result?.canonical_deployment;
  if (!success || result?.name !== project || !result.domains?.includes(host) || !deployment?.id
    || deployment.environment !== 'production' || deployment.is_skipped
    || deployment.latest_stage?.name !== 'deploy' || deployment.latest_stage.status !== 'success') {
    throw new Error('Cloudflare Pages has no verified successful active production deployment for ' + host);
  }
  if (env.INDEXNOW_DEPLOYMENT_ID && deployment.id !== env.INDEXNOW_DEPLOYMENT_ID) {
    throw new Error('The requested Pages deployment is not the active production deployment. No URLs were submitted for it.');
  }
  return deployment.id;
}

async function resolveDirectory(path) {
  return realpath(path).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return resolve(await resolveDirectory(parent), relative(parent, path));
  });
}

async function manifestPath(value) {
  const path = resolve(value);
  const parent = dirname(path);
  const current = await resolveDirectory(parent);
  for (const folder of ['public', 'dist']) {
    const output = resolve(root, folder);
    const currentOutput = await resolveDirectory(output);
    for (const [base, destination] of [[output, path], [currentOutput, current]]) {
      const child = relative(base, destination);
      if (!child || (!isAbsolute(child) && child !== '..' && !child.startsWith('..' + sep))) {
        throw new Error('The IndexNow manifest must be kept outside public/ and dist/.');
      }
    }
  }
  return path;
}

async function loadManifest(path) {
  try {
    const state = JSON.parse(await readFile(path, 'utf8'));
    if (state?.version !== 1 || state.origin !== origin || typeof state.ready !== 'boolean'
      || !state.pages || Array.isArray(state.pages) || typeof state.pages !== 'object'
      || Object.entries(state.pages).some(([url, hash]) => editorialUrl(url) !== url || typeof hash !== 'string' || !sha256.test(hash))) {
      throw new Error('Unrecognized or invalid IndexNow manifest: ' + path);
    }
    return { ...state, pages: new Map(Object.entries(state.pages)) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { version: 1, origin, ready: false, pages: new Map() };
  }
}

async function saveManifest(path, state, deployment, log) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  const data = {
    version: 1, origin, ready: state.ready, deployment,
    pages: Object.fromEntries([...state.pages].sort(([a], [b]) => a.localeCompare(b))),
  };
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  log('Manifest saved to ' + path);
}

async function inspectPage(request, url) {
  const response = await request(url, { headers: { Accept: 'text/html' }, limit: htmlLimit });
  const { status, headers } = response;
  if ([404, 410].includes(status)) return { removed: true, reason: 'HTTP ' + status };
  if ([301, 308].includes(status) && headers.has('Location')) return { removed: true, reason: 'permanent redirect' };
  if ([301, 302, 303, 307, 308, 401, 403].includes(status)) return { hold: true, reason: 'HTTP ' + status };
  if (status !== 200) throw new Error('Unable to inspect ' + url + ' (HTTP ' + status + '). The manifest was not advanced.');
  if (!/^text\/html\b/i.test(headers.get('Content-Type') ?? '')) return { reason: 'not HTML' };
  return pageFingerprint(response.bytes.toString('utf8'), url, headers.get('X-Robots-Tag') ?? '');
}

async function plan(request, candidates, previous, isAllowed, mode, urls) {
  const current = new Map();
  const retained = new Map();
  const removed = [];
  const review = [...new Set([...candidates, ...previous.keys()])].filter(isAllowed);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(6, review.length) }, async () => {
    while (index < review.length) {
      const url = review[index++];
      const page = await inspectPage(request, url);
      if (page.hash && candidates.has(url)) current.set(url, page.hash);
      else if (previous.has(url) && page.removed) removed.push(url);
      else if (previous.has(url) && (page.hash || page.hold)) retained.set(url, previous.get(url));
    }
  }));
  if (!current.size) throw new Error('No canonical, indexable HTML pages were found. No URLs will be submitted.');
  const added = [...current.keys()].filter((url) => !previous.has(url)).sort();
  const modified = [...current.keys()].filter((url) => previous.has(url) && previous.get(url) !== current.get(url)).sort();
  const deleted = removed.sort();
  let submission = mode === 'all' ? [...current.keys(), ...deleted].sort() : [...added, ...modified, ...deleted];
  if (mode === 'urls') {
    submission = [...new Set(urls.map((url) => {
      const candidate = editorialUrl(url);
      if (!candidate || !current.has(candidate)) throw new Error('URL is not a canonical, indexable production sitemap URL: ' + url);
      return candidate;
    }))].sort();
  }
  return { current, retained, added, modified, deleted, submission };
}

export function* batches(urls) {
  const unique = [...new Set(urls)];
  for (let start = 0; start < unique.length; start += maxBatchSize) yield unique.slice(start, start + maxBatchSize);
}

const indexNowErrors = {
  400: 'Bad request. Check the JSON format and URL list.',
  403: 'Key verification failed. Verify the deployed key file and its contents.',
  422: 'Host, key, or URL does not match the IndexNow protocol.',
  429: 'Rate limited after retries. Wait before submitting again.',
};

export async function runIndexNow({
  mode, urls = [], dryRun = false, env = process.env, fetcher = fetch, wait = sleep,
  now = Date.now, log = console.log, keyDirectory,
}) {
  const readOnly = mode === 'check' || dryRun;
  if (!['check', 'all', 'changed', 'urls'].includes(mode) || (mode === 'urls' && !urls.length)) throw new Error('Invalid IndexNow mode or URL list.');
  if (!readOnly && env.CF_PAGES === '1') throw new Error('IndexNow does not submit from Cloudflare Pages builds. Run it after production is deployed.');
  if (!readOnly && env.CI && !env.INDEXNOW_MANIFEST) throw new Error('CI must set INDEXNOW_MANIFEST to a restored private, persistent manifest path.');
  if (!readOnly && env.CI && !env.INDEXNOW_DEPLOYMENT_ID) throw new Error('CI must set INDEXNOW_DEPLOYMENT_ID to the verified production release ID.');
  const key = await findKey(keyDirectory);
  const request = httpClient({ fetcher, wait, now, log });
  const path = await manifestPath(env.INDEXNOW_MANIFEST ?? resolve(root, '.indexnow', 'manifest.json'));
  let lock;
  const lockPath = path + '.lock';
  try {
    if (!readOnly) {
      await mkdir(dirname(path), { recursive: true });
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error('An IndexNow run is already using this manifest: ' + path);
        throw error;
      }
    }
    const deployment = readOnly ? null : await activeDeployment(request, env);
    const keyLocation = await verifyKey(request, key);
    const { locations, files } = await discover(request);
    const robots = await request(origin + '/robots.txt', { limit: 512 * 1024 });
    if (![200, 404, 410].includes(robots.status)) throw new Error('Unable to verify production robots.txt (HTTP ' + robots.status + ').');
    const allowed = robotsRules(robots.bytes?.toString('utf8') ?? '');
    const candidates = new Set(locations.filter((url) => typeof url === 'string' && url.startsWith(origin + '/'))
      .map(editorialUrl).filter((url) => url && allowed(url)));
    log('Key verified on production. Discovered ' + locations.length + ' URL entries in ' + files + ' sitemap file(s).');
    if (!candidates.size) throw new Error('No eligible production URLs were found in the sitemap.');
    if (mode === 'check') {
      log('Sitemap and key checks passed. ' + candidates.size + ' unique URL candidate(s); 0 submitted.');
      return { discovered: locations.length, candidates: candidates.size, submitted: 0 };
    }

    const state = await loadManifest(path);
    if (mode === 'changed' && !state.ready && !dryRun) {
      throw new Error('No completed initial baseline. Run indexnow:all after the first successful production deployment.');
    }
    const changes = await plan(request, candidates, state.pages, allowed, mode, urls);
    const summary = {
      discovered: locations.length, eligible: changes.current.size, added: changes.added.length,
      modified: changes.modified.length, deleted: changes.deleted.length,
      skipped: locations.length - changes.current.size, submitted: 0,
    };
    log(Object.entries(summary).filter(([label]) => label !== 'submitted').map(([label, value]) => label + ' ' + value).join(', ') + '.');
    if (dryRun) {
      for (const url of changes.submission) log(url + (changes.deleted.includes(url) ? ' (removed)' : ''));
      log('Dry run: ' + changes.submission.length + ' planned, 0 submitted. Manifest was not changed.');
      return summary;
    }

    try {
      for (const batch of batches(changes.submission)) {
        if (await activeDeployment(request, env) !== deployment) throw new Error('Production changed during the scan. Rerun for the active deployment.');
        const response = await request(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host, key, keyLocation, urlList: batch }),
        });
        if (![200, 202].includes(response.status)) {
          throw new Error('IndexNow HTTP ' + response.status + ': ' + (indexNowErrors[response.status] ?? 'Unexpected response. Retry after checking the service.'));
        }
        for (const url of batch) {
          if (changes.current.has(url)) state.pages.set(url, changes.current.get(url));
          else state.pages.delete(url);
        }
        summary.submitted += batch.length;
        log('IndexNow accepted ' + batch.length + ' URL(s) (HTTP ' + response.status + (response.status === 202 ? ', key validation pending' : '') + ').');
        // Checkpoint accepted batches so retrying a partial submission in changed mode does not resend them.
        state.ready ||= mode !== 'urls';
        await saveManifest(path, state, deployment, log);
      }
      if (mode !== 'urls') {
        if (await activeDeployment(request, env) !== deployment) throw new Error('Production changed during the scan. Rerun for the active deployment.');
        const pages = new Map([...changes.retained, ...changes.current]);
        if (pages.size !== state.pages.size || [...pages].some(([url, hash]) => state.pages.get(url) !== hash)) {
          await saveManifest(path, { ...state, ready: true, pages }, deployment, log);
        }
      }
    } finally {
      log('Submitted ' + summary.submitted + ' URL(s).');
    }
    return summary;
  } finally {
    if (lock) {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
}

const usage = 'Usage: node scripts/indexnow.mjs <all|changed|check|URL...> [--dry-run]';
export async function main(args) {
  const { positionals, values } = parseArgs({
    args, allowPositionals: true, options: { 'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help || !positionals.length) {
    console.log(usage);
    return;
  }
  const [first, ...rest] = positionals;
  let mode = ['all', 'changed', 'check'].includes(first) ? first : 'urls';
  const urls = mode === 'urls' ? positionals : rest;
  if (mode === 'changed' && urls.length) mode = 'urls';
  if (mode !== 'urls' && urls.length) throw new Error(usage);
  await runIndexNow({ mode, urls, dryRun: values['dry-run'] });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error('IndexNow: ' + error.message);
    process.exitCode = 1;
  });
}
