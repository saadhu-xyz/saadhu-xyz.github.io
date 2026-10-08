/* ============================================================
   Getting started — macOS / Linux tabs
   ------------------------------------------------------------
   The open tab lives in the URL hash (#macos, #linux), so a link can send
   someone straight to their platform and a reload keeps it. A hash naming a
   step inside a panel (#linux-pair) opens that panel too. With no hash, the
   visitor's own OS picks: Linux gets Linux, everyone else macOS — the guide
   is about the server, and a phone visitor is most likely setting up a Mac.

   Without JavaScript both panels simply show, one after the other.
   ============================================================ */
(function () {
  const tabs = Array.from(document.querySelectorAll('.tabs [role="tab"]'));
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  if (!tabs.length) return;

  function select(i, { focus = false, updateHash = false } = {}) {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
    // replaceState, not location.hash: assigning the hash would scroll the
    // page to the panel and stack a history entry per click.
    if (updateHash) history.replaceState(null, "", "#" + panels[i].id);
  }

  function fromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return -1;
    const target = document.getElementById(id);
    return target ? panels.findIndex((p) => p.contains(target)) : -1;
  }

  function fromOS() {
    const ua = navigator.userAgent || "";
    const p = navigator.platform || "";
    const linux = /Linux/i.test(p) && !/Android/i.test(ua);
    return panels.findIndex((pl) => pl.id === (linux ? "linux" : "macos"));
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(i, { updateHash: true }));
    t.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      select((i + step + tabs.length) % tabs.length, { focus: true, updateHash: true });
    });
  });

  window.addEventListener("hashchange", () => {
    const i = fromHash();
    if (i >= 0) select(i);
  });

  const initial = fromHash();
  select(initial >= 0 ? initial : Math.max(fromOS(), 0));
  // The panel was hidden when the browser tried to scroll to a step in it.
  if (initial >= 0 && location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    // Instant: the page's smooth scrolling would start from the top.
    if (target && !target.matches('[role="tabpanel"]')) target.scrollIntoView({ behavior: "instant" });
  }
})();
