# Anton — downloads site

A single, self-contained static site for distributing Anton's binaries:

- **Mobile app** (Android APK, iOS TestFlight) — the primary client for both modes
- **Server** (macOS `.dmg`, Linux `.tar.gz`) — ships three Go binaries:
  `anton` (Interactive Development Server, `:8765`),
  `anton-ticketing` (Ticketing Service, `:8766`), and
  `anton-impl-server` (Implementation worker, outbound-only)

## Run

```sh
./serve.sh              # http://localhost:3000  (python3 or npx serve)
# or
python3 -m http.server 3000
```

No build step, no dependencies. Just three files: `index.html`, `styles.css`, `app.js`.

## Wire up real downloads

All download URLs live in one place: the `DOWNLOADS` map at the top of **`app.js`**.
Replace each `"#"` placeholder with a real URL and bump `VERSIONS`:

```js
const VERSIONS = { mobile: "v1.0.0", server: "v1.0.0" };

const DOWNLOADS = {
  "android":      "https://github.com/<you>/anton/releases/latest/download/anton.apk",
  "ios":          "https://testflight.apple.com/join/XXXXXXXX",
  "macos-arm64":  "https://github.com/<you>/anton/releases/latest/download/Anton-arm64.dmg",
  "macos-x86_64": "https://github.com/<you>/anton/releases/latest/download/Anton-x86_64.dmg",
  "linux-amd64":  "https://github.com/<you>/anton/releases/latest/download/anton-linux-amd64.tar.gz",
  "linux-arm64":  "https://github.com/<you>/anton/releases/latest/download/anton-linux-arm64.tar.gz",
};
```

Any URL that is still `"#"` renders as a disabled "Coming soon" button, so the page
always looks complete. Same-origin URLs (e.g. `/downloads/foo.tar.gz`) get a
`download` attribute automatically; external URLs open with `rel="noopener"`.

## Features

- Auto-detects the visitor's OS and highlights the matching download card
- Copy buttons on the install snippets
- Dark technical / terminal theme, responsive down to mobile
