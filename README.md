# Anton — downloads site

A single, self-contained static site for distributing Anton's binaries:

- **Mobile app** (Android APK, iOS TestFlight) — the primary client for both modes
- **Server** (macOS `.dmg`, Linux `.tar.gz`) — ships three Go binaries:
  `anton` (Interactive Development Server, `:8765`),
  `anton-ticketing` (Ticketing Service, `:8766`), and
  `anton-impl-server` (Implementation worker, outbound-only)

## Run locally

```sh
./serve.sh              # http://localhost:3000  (python3 or npx serve)
# or
python3 -m http.server 3000
```

No build step, no dependencies. Four files: `index.html`, `styles.css`, `app.js`,
`releases.json`.

## Deploy

The site is live on **GitHub Pages** at <https://saadhu-xyz.github.io/>, served
straight from `main` at the repository root. There is no build and no workflow:
pushing to `main` publishes, usually within a minute.

`.nojekyll` disables Jekyll preprocessing. The site is already plain static HTML,
so Jekyll would add nothing but a build step that can fail.

Because every path in the page is relative, the same tree serves correctly from
`./serve.sh`, from a subdirectory, and from the Pages root — nothing is pinned to
a particular origin.

## Where downloads come from

Every link and version on the page comes from `releases.json`, a verbatim copy of
the release manifest the in-app updater reads. `app.js` fetches it on load and
fills in each platform card. A platform absent from the manifest renders as
"Coming soon" rather than a link that 404s, and platforms release independently,
so each card shows the version that platform was genuinely last built at.

The manifest is copied here rather than fetched from GitHub at page load because
GitHub sends no `Access-Control-Allow-Origin` on release assets — the download
302s to `release-assets.githubusercontent.com`, which sets no CORS headers — so a
browser fetch straight to the release is blocked. Serving it from the site's own
origin sidesteps that.

Refresh it from the published release with:

```sh
../anton/packaging/update-website.sh
```

which rewrites `releases.json`, commits, and pushes — the push is what takes it
live. Pass `--no-push` to stop at the file write.

## Features

- Auto-detects the visitor's OS and highlights the matching download card
- Copy buttons on the install snippets
- Dark technical / terminal theme, responsive down to mobile
