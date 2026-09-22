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

No build step, no dependencies:

| File | What |
|---|---|
| `index.html` | the landing page |
| `styles.css`, `app.js` | its styles and download wiring |
| `releases.json` | the release manifest, refreshed by `packaging/release.sh` |
| `install.sh` | the macOS installer |
| `install-linux.sh` | the Linux CLI installer |
| `install-script.html`, `install-linux-script.html` | "read it before you run it" pages |
| `script-viewer.css`, `script-viewer.js` | shared by those two pages |

## The macOS installer (`install.sh`)

Served at <https://saadhu-xyz.github.io/install.sh> and run as:

```sh
curl -fsSL https://saadhu-xyz.github.io/install.sh | bash
```

It exists because of a Gatekeeper dead end. Anton is an unsigned personal build, a
browser stamps every download with `com.apple.quarantine`, and everything inside a
quarantined DMG inherits that — including `Install Anton.command`, which is a shell
script and so has no signature for Gatekeeper to check. macOS 15 removed the
right-click → Open bypass, so the double-click became unrecoverable for anyone who
doesn't know about System Settings → Privacy & Security. Notarizing would not fix it
either: it would clear `Anton.app`, never a script.

The flag is set by whatever downloads the file, and `curl` sets nothing. Moving the
download out of the browser removes the whole problem rather than working around it.

The script deliberately installs nothing itself. It reads `releases.json`, picks the
DMG for the host's chip (consulting `sysctl.proc_translated`, since `uname -m` lies
under Rosetta), verifies the published SHA256, mounts it, and runs the
`Install Anton.command` inside it under `bash` — which Gatekeeper never checks,
because its check lives in LaunchServices. So the install steps stay in one place, in
the anton repo at `packaging/macos/app-template/Install Anton.command`, versioned
with the build they install.

It lives at the repo root rather than under a subdirectory because the URL is the
interface: it is pasted into terminals and quoted in docs, and should not move.
`plutil` parses the manifest, so there is no `jq` or `python3` dependency on the
user's Mac.

## The Linux installer (`install-linux.sh`)

Served at <https://saadhu-xyz.github.io/install-linux.sh> and run as:

```sh
curl -fsSL https://saadhu-xyz.github.io/install-linux.sh | bash
curl -fsSL https://saadhu-xyz.github.io/install-linux.sh | bash -s -- --no-startup
```

There is no Gatekeeper story here — nothing on Linux is signed, quarantined or
blocked. This exists for the ordinary reason: one line beats "download, verify,
untar, read the README, run the installer".

It follows the same delegation as the macOS script, and for the same reason. It
reads `releases.json`, downloads the `linux-x86` tarball, verifies the published
SHA256, unpacks it, and runs the `install-anton.sh` that ships inside — which is
where the install steps actually live, in the anton repo at
`packaging/linux/cli-template/install-anton.sh`, versioned with the build they
install. Flags after `--` are passed straight through to it.

That installer puts the four binaries in `~/.local/share/anton/bin` with the three
services linked into `~/.local/bin`, installs the Claude Code plugin, writes systemd
**user** units, offers to enable start-at-boot (`systemctl --user enable` plus
`loginctl enable-linger`), starts everything, and ends with the two dashboard links,
the admin token and the mobile pairing QR. Nothing needs root.

macOS has `plutil`; Linux has no JSON parser it can count on, so `manifest_field`
tries `jq`, then `python3`, then falls back to flattening the document and matching
within one artifact's braces — which holds because every field it reads is a string.

### Reading them before running them (`install-script.html`, `install-linux-script.html`)

GitHub Pages serves `.sh` as `application/x-sh`, which browsers download rather
than display, and Pages has no way to override a response header. So a plain link
to `install.sh` hands over a file instead of showing one — the wrong answer for a
link whose entire job is "look at this before you pipe it into bash".

Each page fetches its script (`./install.sh`, `./install-linux.sh`) at the URL the
curl command reads and prints it. Fetching sidesteps the Content-Type question
entirely, and because the bytes come from that URL rather than from a pasted copy,
what is read cannot drift from what is run. Linking to the file on GitHub would have
been one line, but it shows the repo's copy rather than what is being served.

The two pages differ only in which file they name, so the behaviour lives once in
`script-viewer.js` and the layout once in `script-viewer.css`; the page says which
script to show with `<code id="src" data-src="./install-linux.sh">`.

Highlighting is a ~10-line tokenizer rather than a CDN library, deliberately: a page
that exists to be audited should not itself load third-party script. The file's text
is HTML-escaped before any markup is added to it.

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

Every release refreshes it: `../anton/packaging/release.sh` copies the new
manifest here as its last step, commits `releases.json` to `main`, and pushes —
the push is what takes it live.

## Features

- Auto-detects the visitor's OS and highlights the matching download card
- Copy buttons on the install snippets
- Dark technical / terminal theme, responsive down to mobile
