/* ============================================================
   Anton downloads site — behavior
   ------------------------------------------------------------
   HOW DOWNLOADS ARE WIRED
   Every link and version on this page comes from releases.json, which is a
   verbatim copy of the release manifest the in-app updater reads. It is
   refreshed by packaging/update-website.sh at publish time.

   Nothing here is hardcoded, and that is the point. Platforms are released
   independently — an Android-only release leaves macOS on whatever it was
   genuinely last built at — so a single hardcoded "current version" would be
   wrong for every platform that release did not rebuild. Reading the manifest
   means the page says exactly what was published, per platform, and cannot
   drift from what the updater offers.

   Served from our own origin rather than fetched from GitHub because GitHub
   sends no Access-Control-Allow-Origin on release assets: the download 302s to
   release-assets.githubusercontent.com, which sets no CORS headers, so a
   browser fetch straight to the release is blocked.

   A platform absent from the manifest renders as "Coming soon" rather than a
   link that 404s.
   ============================================================ */

/* data-dl / data-ver attribute -> the platform key in the manifest. The
   attribute names are the page's vocabulary, the keys are the manifest's; this
   is the one place the two meet. */
const PLATFORM_OF = {
  "android":      "android",
  "ios":          "ios",
  "macos-arm64":  "macos-arm64",
  "macos-x86_64": "macos-intel",
  "linux-amd64":  "linux-x86",
  // Legacy grouped labels, kept so older markup keeps working. "server" maps to
  // Linux because that is the only server artifact this page links directly.
  "mobile":       "android",
  "server":       "linux-x86",
  "macos":        "macos-arm64",
  "linux":        "linux-x86",
};

/* ---- release data ---- */
async function loadReleases() {
  try {
    const res = await fetch("./releases.json", { cache: "no-cache" });
    if (!res.ok) return {};
    const manifest = await res.json();
    return manifest && typeof manifest.artifacts === "object" ? manifest.artifacts : {};
  } catch {
    // A missing or unparseable releases.json leaves every button as "Coming
    // soon". Degrading to that is right: a dead link that looks live is worse
    // than an honest placeholder.
    return {};
  }
}

function wireDownloads(artifacts) {
  document.querySelectorAll("[data-dl]").forEach((el) => {
    const art = artifacts[PLATFORM_OF[el.getAttribute("data-dl")]];
    const url = art && art.url;

    el.setAttribute("href", url || "#");
    if (!url) {
      el.setAttribute("title", "Download link coming soon");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        flash(el, "Coming soon");
      });
      return;
    }
    el.setAttribute("rel", "noopener");
    if (art.version) el.setAttribute("title", `${art.version} · ${formatSize(art.size)}`);
  });
}

function fillVersions(artifacts) {
  document.querySelectorAll("[data-ver]").forEach((el) => {
    const art = artifacts[PLATFORM_OF[el.getAttribute("data-ver")]];
    el.textContent = (art && art.version) || "";
  });
}

function formatSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

loadReleases().then((artifacts) => {
  wireDownloads(artifacts);
  fillVersions(artifacts);
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
