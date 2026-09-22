/* ============================================================
   Shell-script viewer — shared by install-script.html (macOS) and
   install-linux-script.html (Linux CLI).
   ------------------------------------------------------------
   These pages exist because GitHub Pages serves .sh as application/x-sh, which
   browsers download rather than display, and Pages offers no way to override a
   response header. Rather than link off-site to the repo, the script is fetched
   from the very URL the curl command uses and printed here — so what is read is
   literally what is run, not a copy that could drift from it.

   Which file to show comes from the markup: <code id="src" data-src="./x.sh">.
   That is the only difference between the two pages, so the behaviour lives
   here once instead of being pasted into each of them and then fixed twice.
   ============================================================ */

/* Shell is highlighted with a deliberately small tokenizer rather than a CDN
   library: a page whose whole purpose is "read this before you run it" should
   not itself pull in third-party script to render. Text is escaped first, so
   the file's own contents can never become markup. */
const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function highlight(src) {
  const KEYWORDS = /\b(if|then|elif|else|fi|for|while|do|done|case|esac|function|local|return|exit|set|trap|echo|printf|read)\b/g;
  return esc(src).split("\n").map((line) => {
    // A full-line comment is the common shape in these files; mark it and stop,
    // so a # inside a string on a code line is not mistaken for one.
    if (/^\s*#/.test(line)) return '<span class="c">' + line + "</span>";
    return line
      .replace(/("[^"]*"|'[^']*')/g, '<span class="s">$1</span>')
      .replace(KEYWORDS, '<span class="k">$1</span>');
  }).join("\n");
}

const target = document.getElementById("src");
const url = (target && target.dataset.src) || "./install.sh";

fetch(url, { cache: "no-cache" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
  .then((text) => {
    target.innerHTML = highlight(text);
    const meta = document.getElementById("meta-size");
    if (meta) {
      const kb = (new Blob([text]).size / 1024).toFixed(1);
      meta.textContent = text.split("\n").length + " lines · " + kb + " KB";
    }
  })
  .catch(() => {
    // Offline, or opened over file://. Say so plainly and leave the links
    // below as the way through, rather than showing an empty box.
    target.textContent =
      "Could not load " + url.replace(/^\.\//, "") + " from this page.\n" +
      "Use the links below to read it instead.";
  });

document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const code = btn.parentElement.querySelector("code");
    try {
      await navigator.clipboard.writeText(code.innerText);
      const prev = btn.textContent;
      btn.textContent = "Copied ✓";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = prev; btn.classList.remove("copied"); }, 1400);
    } catch { btn.textContent = "Press ⌘/Ctrl+C"; }
  });
});
