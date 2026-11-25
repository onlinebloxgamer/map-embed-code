# IndexNow for Cloudflare Pages

IndexNow sends URL-change notifications to participating search engines. The CLI posts JSON to `https://api.indexnow.org/indexnow` with `host`, `key`, `keyLocation`, and `urlList`. Notifications do not guarantee indexing. [IndexNow protocol](https://www.indexnow.org/documentation) · [IndexNow FAQ](https://www.indexnow.org/faq)

## First production deployment

1. Deploy the project using the existing Cloudflare Pages workflow. The build copies the public verification file to the site root. Keep the file name and its contents the same as the key. [Production key file](https://map-embed-code.com/1026c3e25aea98238fedc6a1c4711f6f.txt)
2. In Cloudflare, create an API token with **Account → Cloudflare Pages → Read** for the account that owns the `map-embed-code` project. The CLI uses it to read the active production deployment. [Pages project API permissions](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/get/)
3. After the production deployment shows **Success**, run these commands from the project root. If you use the optional CI workflow below, initialize the baseline there instead so both deployment checks and notifications use a single manifest.

```powershell
npm run indexnow:check
npm run indexnow:all -- --dry-run
$env:CLOUDFLARE_ACCOUNT_ID = 'your-32-character-account-id'
$env:CLOUDFLARE_INDEXNOW_TOKEN = [System.Net.NetworkCredential]::new('', (Read-Host 'Pages Read token' -AsSecureString)).Password
npm run indexnow:all
```

The check and dry run only make GET requests to the production website. The check validates the key and sitemap tree and lists the count of URL candidates. The dry run also inspects page HTML, compares it with the manifest, and prints the URLs it would submit. It does not require a Cloudflare API token or write state.

## Subsequent deployments and individual URLs

After a successful production deployment, use the same manifest to preview and submit only changes.

```powershell
npm run indexnow:changed -- --dry-run
npm run indexnow:changed
```

For an explicit request to submit specific URLs, use their canonical sitemap addresses or site-relative paths. The command validates the entire selection before sending a POST.

```powershell
node scripts/indexnow.mjs https://map-embed-code.com/es/ /guides/how-to-create-map-with-multiple-pins/ --dry-run
node scripts/indexnow.mjs https://map-embed-code.com/es/ /guides/how-to-create-map-with-multiple-pins/
```

A live submission checks the successful canonical deployment through the Cloudflare Pages API and verifies the production key file. The script rechecks the deployment ID before each batch. Set `INDEXNOW_DEPLOYMENT_ID` to the expected Pages deployment ID when running from deployment automation. A stale or preview ID fails the check.

## Private manifest and CI

The default local manifest is `.indexnow/manifest.json`. It is excluded from Git and sits outside the public and build directories. Back it up or move it to another private, persistent path with `INDEXNOW_MANIFEST`. Reuse the same file after every production deployment. `indexnow:all` initializes the baseline and explicitly sends every currently eligible sitemap URL. It also reports known removals. Later `indexnow:changed` runs send added, modified, and removed URLs only. An explicit individual submission updates only that URL's record.

The repository includes an optional **IndexNow after production deploy** GitHub Actions workflow. The site has no repository-managed post-deployment event to attach to, so the workflow uses manual dispatch after Cloudflare marks the deployment successful. It leaves the Pages deployment workflow in place. The workflow serializes runs and commits accepted state to a separate private GitHub repository.

1. Create or choose a **private** GitHub repository with an initialized default branch for the manifest. GitHub Free supports private repositories. [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
2. In the website repository's Actions settings, set variables `INDEXNOW_STATE_REPOSITORY` to `owner/private-repository` and `CLOUDFLARE_ACCOUNT_ID` to the Pages account ID.
3. Add secrets `CLOUDFLARE_INDEXNOW_TOKEN` for the Pages Read token and `INDEXNOW_STATE_TOKEN` for a fine-grained GitHub token limited to the private state repository with **Contents: Read and write**. The workflow checks the repository's visibility before checkout. [Fine-grained GitHub tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
4. After confirming the production deployment, open **Actions → IndexNow after production deploy → Run workflow** on the default branch. Enter the active deployment ID. Use `all` on initial setup and `changed` on later runs. Leave **Preview URLs without submitting** checked for a dry run, then clear it for the live run.

If you use a different CI service, restore the same private manifest before the indexing step, set `INDEXNOW_MANIFEST` and `INDEXNOW_DEPLOYMENT_ID`, and run `npm run indexnow:changed` only after the production deploy succeeds. Persist manifest updates even if a later batch fails, and serialize jobs that share the manifest. These commands are separate from ordinary builds, local development, and preview deploys.

## URL selection and change detection

- Start from `/sitemap-index.xml` on the production domain and read its child sitemaps recursively. Deduplicate URL entries. Preview and external hosts, queries and fragments, files, reserved private and administrative paths, APIs, saved-map viewers, and iframe routes are excluded.
- Require a direct HTTP 200 HTML response, an exact self-canonical, and no `noindex` header or meta directive. The CLI conservatively excludes paths blocked by production `robots.txt` for any declared agent.
- Previously eligible pages returning 404, 410, or a permanent redirect are reported using the original URL. A missing sitemap entry alone does not qualify as a removal. A live, still-canonical page omitted from the sitemap stays tracked for future removal checks.
- The manifest fingerprints titles, descriptions, selected metadata, structured data, and the rendered main content including links and image references. It ignores generated asset scripts and styles, build-time markers, schema dates, and sitemap timestamps. A binary asset replaced at the same URL and JavaScript-only changes are not detected when the relevant HTML stays the same. Use an explicit individual submission when needed.

## Responses and troubleshooting

| Result | Meaning and action |
| --- | --- |
| HTTP 200 | Accepted. The CLI saves that batch to the manifest. |
| HTTP 202 | Received, with key verification pending. The CLI records it as accepted and avoids sending the same changes again on the next deployment. |
| HTTP 400 | Invalid payload. Check the reported error before retrying. |
| HTTP 403 | Key verification failed. Run `npm run indexnow:check` and verify the key is deployed at the root with the exact matching text. |
| HTTP 422 | Host, key format, or URL scope mismatch. Verify that all URLs use the production host and match the site key. |
| HTTP 429, 5xx, or network failure | The CLI tries up to four times using backoff and honors `Retry-After`. If the requested delay exceeds 60 seconds or retries are exhausted, rerun later in `changed` mode. |
| Invalid sitemap or failed page inspection | Fix the production response and retry. A failed scan does not mark URLs as deleted. |
| Manifest locked | Wait for the other job to finish. If an interrupted process left a stale lock, remove the corresponding `.lock` file after confirming that no job is running. |

Each request contains at most 10,000 URLs. Accepted batches are checkpointed before the next batch. If a service accepts a request and the response is lost, a retry may send the same notification. [IndexNow response codes](https://www.indexnow.org/documentation)

## Local tests

```sh
npm run test:indexnow
npm run build
```

The tests use mocked network responses and temporary manifests. They do not post to IndexNow.
