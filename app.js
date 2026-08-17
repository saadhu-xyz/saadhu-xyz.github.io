/* ============================================================
   Anton downloads site — behavior
   ------------------------------------------------------------
   HOW DOWNLOADS ARE WIRED
   Artifacts live on GitHub Releases in the PUBLIC saadhu-xyz/anton-releases
   repo — not in saadhu-xyz/anton, which is private and whose asset URLs
   therefore 404 for anyone without repo access.

   `latest/download/<file>` always resolves to the newest release, so
   publishing a new build updates every link here with no code change.
   Pin a version by swapping `latest/download` for `download/<tag>`.

   Filenames are load-bearing: they must match what
   anton-releases/scripts/publish-release.sh uploads.

   A "#" means "not built yet" — the button renders as "Coming soon"
   rather than a link that 404s. Fill it in once the artifact ships.
   Also bump VERSIONS when you cut a release.
   ============================================================ */

const VERSIONS = {
  mobile: "v1.0.0",
  server: "v1.0.0",
};

const RELEASES = "https://github.com/saadhu-xyz/anton-releases/releases/latest/download";

const DOWNLOADS = {
  // Mobile
  "android":       `${RELEASES}/anton.apk`,
  "ios":           "#",   // e.g. https://testflight.apple.com/join/XXXXXXXX

  // macOS (Anton.app DMGs — bundles & supervises all three server binaries).
  // Built only on a Mac via packaging/macos/build-on-mac.sh.
  "macos-arm64":   "#",   // → `${RELEASES}/Anton-arm64.dmg`
  "macos-x86_64":  "#",   // → `${RELEASES}/Anton-x86_64.dmg`

  // Linux (tarball with `anton` + `anton-ticketing` + `anton-impl-server`)
  "linux-amd64":   "#",   // → `${RELEASES}/anton-linux-amd64.tar.gz`
  "linux-arm64":   "#",   // → `${RELEASES}/anton-linux-arm64.tar.gz`
};

/* ---- wire download buttons ---- */
document.querySelectorAll("[data-dl]").forEach((el) => {
  const key = el.getAttribute("data-dl");
  const url = DOWNLOADS[key];
  const placeholder = !url || url === "#";
  el.setAttribute("href", url || "#");
  if (placeholder) {
    el.setAttribute("title", "Download link coming soon");
    el.addEventListener("click", (e) => {
      e.preventDefault();
      flash(el, "Coming soon");
    });
  } else if (!url.startsWith("http") || url.includes(location.host)) {
    el.setAttribute("download", "");
  } else {
    el.setAttribute("rel", "noopener");
  }
});

/* ---- fill version labels ---- */
document.querySelectorAll("[data-ver]").forEach((el) => {
  const which = el.getAttribute("data-ver");
  el.textContent = VERSIONS[which] || "";
});

/* ---- OS detection: highlight the visitor's platform ---- */
(function detectOS() {
  const ua = navigator.userAgent || "";
  const p = navigator.platform || "";
  let os = null;
  if (/Android/i.test(ua)) os = "android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "ios";
  else if (/Mac/i.test(p) || /Mac OS X/i.test(ua)) os = "macos";
  else if (/Linux/i.test(p) && !/Android/i.test(ua)) os = "linux";
  else if (/Win/i.test(p)) os = null; // no Windows server build

  // hero button label
  const label = document.querySelector(".os-label");
  const names = { android: "Android", ios: "iOS", macos: "macOS", linux: "Linux" };
  if (label && os) label.textContent = "Download for " + names[os];

  // badge the matching card
  if (os) {
    const card = document.querySelector(`.card[data-platform="${os}"]`);
    if (card) {
      card.classList.add("is-your-os");
      const h4 = card.querySelector("h4");
      if (h4 && !h4.querySelector(".your-os-badge")) {
        const badge = document.createElement("span");
        badge.className = "your-os-badge";
        badge.textContent = "your OS";
        h4.appendChild(badge);
      }
    }
  }
})();

/* ---- copy buttons on code blocks ---- */
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const code = btn.parentElement.querySelector("code");
    const text = code ? code.innerText : "";
    try {
      await navigator.clipboard.writeText(text);
      const prev = btn.textContent;
      btn.textContent = "Copied ✓";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = prev; btn.classList.remove("copied"); }, 1400);
    } catch {
      flash(btn, "Press ⌘/Ctrl+C");
    }
  });
});

/* ---- small helper: transient label swap ---- */
function flash(el, msg) {
  const prev = el.textContent;
  el.textContent = msg;
  setTimeout(() => { el.textContent = prev; }, 1300);
}

/* ---- footer year ---- */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
