# Multiple location maps

## Architecture

Astro builds the editor and content hub as static pages on the existing Cloudflare Pages Free project. Pages Functions handle map creation, retrieval, recovery, updates, and deletion. Cloudflare D1 Free is the only persistent map store. Maps remain publicly accessible at `/map/:id` and `/embed/:id`. The iframe URL contains only the existing opaque map ID.

MapLibre GL JS renders the interactive map. It loads the renderer, local worker, and marker styles only on the editor and valid viewer pages. Its GeoJSON source clusters locations on the client. CSV parsing and marker interactions also run in the browser. Coordinates, map clicks, and coordinate CSVs need no geocoding service. Cloudflare Turnstile Free protects publishing and the optional search session.

## OpenFreeMap

The browser requests styles, vector tiles, sprites, and glyphs directly from OpenFreeMap. It uses Liberty, Bright, Positron, and Dark at `https://tiles.openfreemap.org/styles/<style>`. Existing records with style IDs `streets`, `light`, or `dark` continue to load as Liberty, Positron, or Dark, respectively. The map displays OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution.

OpenFreeMap advertises no keys, accounts, or map-view limits for its public instance, and its FAQ allows commercial use. Its terms provide no availability guarantee and permit discontinuation. Normal interactive requests use the viewport and zoom that the reader sees. The application performs no scraping, offline downloads, tile proxying, or prefetch across regions. The terms separately limit offline downloads to 3,000 tiles or 50 MB, at most four parallel requests, and an identifying User-Agent. The app uses a coordinate grid if a basemap style times out and shows saved locations as text when the browser cannot initialize WebGL. [OpenFreeMap FAQ](https://openfreemap.org/) · [Quick start](https://openfreemap.org/quick_start/) · [Terms](https://openfreemap.org/tos/) · [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)

## Address search and CSV

Komoot’s shared Photon demo allows project use within an undefined “reasonable” request volume. It publishes neither a numeric allowance nor approval for the expected production traffic or bulk workloads. It may throttle or block extensive use and gives no availability guarantee. This app rejects the shared demo hostname and defaults to coordinates and map clicks. The fallback keeps bulk paste, CSV preview, partial import, and row editing available. Address-only rows stay in the preview until the user supplies coordinates or retries with authorized lookup enabled. Lookups for an existing location are unnecessary when two valid coordinates are already present.

Use a Photon instance you operate on existing no-cost infrastructure, or an instance whose operator has explicitly authorized this use, its expected volume, and caching. Komoot can authorize an appropriate deployment for larger traffic if it offers one. Planet-wide Photon runs on Java 21+ and requires substantial disk and memory. The repository documents about 95 GB of disk and recommends at least 64 GB RAM as of 2026. It does not run inside a Pages Function. A regional extract on infrastructure you already have is another option. No hosting for Photon is provisioned by this project. [Photon public-service and hosting documentation](https://github.com/komoot/photon#demo-server) · [Photon search API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)

Set `PHOTON_BASE_URL` to the approved HTTPS origin. The Function sends requests only to that origin’s fixed `/api` path. It rejects caller-provided destinations, literal IPs, local suffixes, URL credentials, redirects, and the known demo hostname. Explicit search by city, complete address, place name, or postcode becomes available when the binding and verification setup are present. Set `PHOTON_ALLOW_AUTOCOMPLETE=true` and `PHOTON_ALLOW_BULK=true` separately if the operator permits those modes. Autocomplete uses three or more characters, a 600 ms debounce, cancellation, and a session cache. Suggestions are capped at five. Bulk lookup is sequential and paced. Multiple candidates require a selection, and provider errors or quota exhaustion leave unresolved rows available for correction.

The downloadable CSV is at `/examples/multiple-map-locations.csv`. Supported headers are `title,address,lat,lon,description,color`. The older `latitude` and `longitude` headers still work. Colors accept the existing names or six-digit hex. Files must fit 128 KiB and the remaining marker capacity. The default is 20 markers per map. An over-limit file reports the remaining capacity before adding any rows.

## Database and caching

[The original D1 migration](../migrations/0001_multiple_location_maps.sql) remains valid. Apply it only if the bound database has not received it.

| Table | Purpose |
| --- | --- |
| `maps` | Random 128-bit public ID, title, description, configuration, hash of a random 256-bit recovery token, and creation and update timestamps |
| `map_rate_limits` | Atomic counters for per-client and global limits |
| `map_geocodes` | Hashed lookup keys, projected Photon results, and expiry timestamps. Photon uses its own cache-key namespace |

A published-map view makes one Pages Function request. The Function reads the public configuration through the same indexed lookup and edge cache used by `GET /api/maps/:id`, then inserts the public snapshot as escaped, inert JSON into the viewer shell. Public map data caches for 60 seconds, and missing IDs for 15 seconds. Updates and deletions evict the current Cloudflare location’s cached copy. Others refresh within the TTL. The viewer HTML and private editing responses use `no-store`. A deleted map returns a readable 404.

The server caches submitted address results for 30 days and misses for one hour. Autocomplete stays in the browser’s session cache. Saved maps have no automatic expiration. Rate counters and geocode cache records can be cleaned in small batches using the D1 console.

~~~sql
DELETE FROM map_geocodes WHERE expires_at < unixepoch();
DELETE FROM map_rate_limits WHERE window < unixepoch() - 172800;
~~~

## API and security

| Method and route | Inputs and success |
| --- | --- |
| `POST /api/maps` | `{ configuration, verification }` with Turnstile action `publish-map`. Returns `201` with a public `id` and the private recovery `token` |
| `GET /api/maps/:id` | Returns `200` with only the public `id` and `configuration` |
| `PATCH /api/maps/:id` | Full replacement configuration and bearer credential. Returns `200` with the same `id` |
| `DELETE /api/maps/:id` | Bearer credential. Returns `204` |
| `POST /api/map-tool/recover` | `{ id }` and bearer credential. Returns the current map for editing |
| `GET /api/map-tool/config` | Returns `markerLimit`, `turnstileSiteKey`, `geocoding`, `geocodeAutocomplete`, and `geocodeBulk` |
| `POST /api/map-tool/session` | `{ verification }` with Turnstile action `geocode`. Returns a signed, half-hour session |
| `POST /api/geocode` | `{ query, mode }`, with `X-Geocode-Session`. Modes are `search`, `autocomplete`, and `bulk`. Returns `results` with title, address, latitude, and longitude |
| `GET /map/:id` and `GET /embed/:id` | Share viewer and map-only cross-origin iframe viewer. Both send `noindex` |

The four map CRUD contracts and recovery contract remain compatible. The map payload contains title, description, markers, and settings. Existing mode, marker icon, and map style IDs remain valid. The server validates JSON bodies and caps them at 256 KiB for maps and 4 KiB for verification, recovery, and search. HTTP and HTTPS are allowed for marker links. Zod validates coordinates, marker counts, and settings. SQL parameters separate data from queries. Marker titles and descriptions render as text. Embed HTML escapes `<` in its inert snapshot. Mutations check a supplied `Origin` and return no cross-origin permission headers. The iframe permits all parent origins and uses a scoped content security policy. Secrets and recovery tokens stay out of URLs, public responses, cache entries, and logs. MapLibre’s Worker is served from the site’s own static assets.

## Cloudflare setup

Use the existing Pages project and keep Workers and D1 on Free. The template uses a placeholder local D1 ID. For staging, bind a separate free database under `MAPS_DB` in the Preview environment and use a Turnstile widget that allows the preview hostname. Use production bindings only in the Production environment.

| Variable or binding | Required value |
| --- | --- |
| `MAPS_DB` | D1 binding for the maps database |
| `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` | Matching free widget key and secret for Publishing |
| `TURNSTILE_HOSTNAME` | Optional expected hostname. Defaults to the request hostname |
| `MAP_SESSION_SECRET` | Random secret of at least 32 characters |
| `MAP_MARKER_LIMIT` | Default 20. Supported range 1–100 |
| `PHOTON_BASE_URL` | Optional authorized HTTPS origin. Blank disables address search |
| `PHOTON_ALLOW_AUTOCOMPLETE` | Defaults to false. Set true only with provider permission |
| `PHOTON_ALLOW_BULK` | Defaults to false. Set true only with provider permission |
| `PHOTON_DAILY_LIMIT` | Uncached attempts per UTC day. Default 1,000, maximum 5,000 |
| `PHOTON_REQUESTS_PER_SECOND` | Fixed-window global cap. Default 2, maximum 10. Use a lower value if the provider requires it |
| `PHOTON_PER_CLIENT_PER_MINUTE` | Search attempts per client. Default 30, maximum 60 |

Generate a local session secret with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`. Set the two secrets using Pages’ encrypted variables, or in the ignored `.dev.vars` file locally. Keep the shared Photon demo unconfigured.

### Local development

~~~powershell
npm ci
npm run astro -- dev --background
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
~~~

For saved maps and embeds, build and run the Pages emulator.

~~~powershell
Copy-Item wrangler.maps.example.jsonc wrangler.local.jsonc
Copy-Item .dev.vars.example .dev.vars
npx wrangler d1 migrations apply MAPS_DB --local --config wrangler.local.jsonc
npm run build
npx wrangler pages dev dist --config wrangler.local.jsonc --port 8788
~~~

Open `http://localhost:8788/multiple-location-map-generator/`. A widget configured for localhost is required for live publishing. The automated tests use local D1 and fixtures for Turnstile and Photon. Install compatible Chromium with `npx playwright install chromium` on systems without it, or set `MAP_TEST_CHROME`.

### Staging and production

Create a database only if the environment lacks one. For each environment, copy the config template locally, fill in the environment’s database name and ID, then apply the existing migration. Keep the local file ignored and add `MAPS_DB` and environment variables through the Pages dashboard.

~~~powershell
npx wrangler d1 create map-embed-code-maps-preview
npx wrangler d1 migrations apply MAPS_DB --remote --config wrangler.local.jsonc
npm run check
npm run test:maps
npx wrangler pages deploy dist --project-name=map-embed-code --branch=maps-staging
~~~

On the preview URL, generate a disposable map using only coordinates. Test its share link and iframe from a different origin, including mobile, attribution, recovery and delete. Check the style and tile requests in DevTools. If an authorized Photon instance is configured, also test search, throttling, and the approved optional modes. Check that the account’s Free plan and remaining D1 capacity are visible in the dashboard. Use `npm run deploy` for production only after explicit approval.

## Free-tier usage

Cloudflare Pages Functions share the Workers Free allowance of 100,000 invocations per day across the account. Static site assets do not count. D1 Free includes 5 million rows read per day, 100,000 written per day, 500 MB per database, and 5 GB per account. Quotas reset daily where specified. Free limits are service limits. Keep the account on Free so the app has no paid request path. Cloudflare Turnstile’s Free plan includes challenge traffic under its widget terms. [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1 pricing and row metering](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)

| Scenario | Approximate daily budget before other account traffic |
| --- | --- |
| 100 maps | About 200 Function requests for editor config plus creation. Approximately 500–600 indexed D1 writes including creation throttles. About 9–18 MB per 30 days at 3–6 KB per map before database overhead |
| 1,000 maps | About 2,000 Function requests and 5,000–6,000 indexed D1 writes. About 90–180 MB per 30 days before overhead |
| 1,000 iframe views | About 1,000 Function requests. Up to 1,000 indexed map lookups on all misses, fewer with cache reuse. No geocoding requests from viewing |
| 10,000 iframe views | About 10,000 Function requests. Up to 10,000 indexed map lookups on all misses, fewer with cache reuse. No geocoding requests from viewing |

At 1,000 creations and 10,000 views per day, coordinate-only use therefore budgets approximately 12,000 Free Function invocations plus optional editing and reloads. These figures assume one editor session per created map. Workers CPU, burst traffic, other account workloads, and the D1 database size still matter. At 1,000 new maps every day, one 500 MB database can fill in roughly three to six months at the illustrative sizes, sooner with indexes and cache growth. Monitor actual D1 writes and storage. A full database can prevent new saves. The app keeps existing IDs and does not automatically delete maps to make room.

Address-only use would generate 500–1,000 potential uncached lookups for 100 maps at 5–10 markers each, or 5,000–10,000 at 1,000 maps per day before autocomplete. The app’s optional upstream budget caps attempts at 1,000 by default. It does not establish an upstream capacity guarantee. Browser tile traffic grows independently with viewports, styles, zoom, and panning. OpenFreeMap currently advertises free access. Its continuity and performance at a particular volume are not guaranteed. A tile outage can leave existing pins usable on a grid while saved configurations remain in D1.

## SEO and regression scope

The homepage and the existing Google My Maps guide retain their URLs and canonical metadata. The five indexable native map pages still cover free map creation, a worked example, marker styling, a first-map tutorial, and CSV/bulk entry respectively. Saved links, viewer shells, and iframe routes stay out of the sitemap. Tutorial images show the migrated renderer. For competitor context, the first version was compared with MapCustomizer’s public editor and help, which document bulk text entry and describe limitations around embedding and clustering. [MapCustomizer FAQ](https://www.mapcustomizer.com/faq)

## Migration files and verification

- `src/lib/multiple-maps/maplibre.ts` replaces `leaflet.ts`. `schema.ts`, `editor.ts`, `client.ts`, `imports.ts`, and `import-dialog.ts` retain the editor workflow and extend it for the authorized provider, styles, and CSV headers. `MapEditor.astro` and `multiple-map-canvas.css` hold the corresponding controls and display styles.
- `functions/_shared/photon.ts` adds bounded search and `functions/_shared/public-map.ts` shares the public map cache. `runtime.ts`, `viewer.ts`, `api/geocode.ts`, `api/map-tool/config.ts`, `api/map-tool/session.ts`, `api/maps/[id].ts`, and `src/pages/map-viewer.astro` connect them to the existing API and viewers. `public/_headers` and `.dev.vars.example` reflect the new network and binding requirements.
- `package.json` and `package-lock.json` install open-source MapLibre and remove Leaflet and its cluster plugin. `tests/multiple-maps-unit.test.mjs` and `tests/multiple-maps.test.mjs` cover source validation, local D1, authorized Photon fixtures, MapLibre, mobile, third-party iframe rendering, and homepage and SEO regression behavior.
- The privacy policy, generator, example page, styling guide, two tutorials, two tutorial screenshots, and sample CSV reflect the new renderer and search availability. The homepage generator, old Google My Maps guide, Pages routes, and D1 migration carry forward without changes from this migration.

Liberty, Bright, Positron, and Dark returned valid style JSON in a live request. The updated screenshots are from the local editor rendering live OpenFreeMap vector tiles in Chrome. Tests use fixtures for Photon and Turnstile. An approved provider’s actual availability and staging Cloudflare bindings still need a smoke test. The MapLibre renderer and local Web Worker account for approximately 445 KiB of gzip-compressed JavaScript combined in the local build and load only for interactive maps.

`npm run check` passed Astro and Worker type checks. `npm run test:maps` built 24 static pages and passed all eight unit, integration, SEO, and browser tests, including a cross-origin iframe with clusters and popups. Vite reports the size of the lazy-loaded MapLibre chunks. The homepage and guides do not load those chunks.
