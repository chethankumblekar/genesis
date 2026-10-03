(() => {
  const PILL_ID = "hh-import-pill";

  const resolveSite = () => {
    try {
      return (globalThis.HH?.sites || []).find((s) => s.matches()) || null;
    } catch {
      return null;
    }
  };

  // Facebook is a single-page app: you land on facebook.com and reach
  // Marketplace without a page load. The content script therefore runs on every
  // page of these sites and decides for itself, rather than relying on the URL
  // at injection time, which is how the pill came to never appear there.
  let site = null;
  let pill = null;
  let label = null;
  let busy = false;
  let observer = null;
  let recountTimer = null;

  function setLabel(text, tone) {
    if (!label) return;
    label.textContent = text;
    pill.style.background =
      tone === "error" ? "#7f1d1d" : tone === "done" ? "#065f46" : "#0f172a";
  }

  function recount() {
    if (busy || !site || !pill) return;
    let count = 0;
    try {
      count = site.harvest().length;
    } catch {
      count = 0;
    }
    const detail = typeof site.isDetail === "function" && site.isDetail();
    setLabel(
      count
        ? detail
          ? "Import this listing"
          : `Import ${count} listing${count === 1 ? "" : "s"}`
        : detail
          ? "Couldn't read this listing"
          : "No listings on this page"
    );
    pill.style.cursor = count ? "pointer" : "default";
  }

  const scheduleRecount = () => {
    clearTimeout(recountTimer);
    recountTimer = setTimeout(recount, 600);
  };

  async function send() {
    if (busy || !site) return;

    const items = site.harvest();
    if (!items.length) {
      setLabel("Nothing to import here", "error");
      setTimeout(recount, 2500);
      return;
    }

    busy = true;
    setLabel(`Sending ${items.length}…`);

    try {
      const reply = await chrome.runtime.sendMessage({
        type: "hh-ingest",
        source: site.id,
        items,
      });

      if (!reply?.ok) {
        setLabel(reply?.error || "Import failed", "error");
      } else {
        const {
          added = 0,
          updated = 0,
          skipped = 0,
          filtered = 0,
        } = reply.counts || {};
        const parts = [`${added} new`];
        if (updated) parts.push(`${updated} updated`);
        if (skipped) parts.push(`${skipped} already seen`);
        if (filtered) parts.push(`${filtered} filtered out`);
        setLabel(parts.join(", "), "done");
      }
    } catch (err) {
      setLabel(err?.message || "Import failed", "error");
    } finally {
      busy = false;
      setTimeout(recount, 4000);
    }
  }

  function createPill() {
    pill = document.createElement("div");
    pill.id = PILL_ID;
    pill.setAttribute("role", "status");
    Object.assign(pill.style, {
      position: "fixed",
      right: "18px",
      bottom: "18px",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 14px",
      borderRadius: "999px",
      background: "#0f172a",
      color: "#f8fafc",
      font: "500 13px/1.3 system-ui, -apple-system, sans-serif",
      boxShadow: "0 8px 24px rgba(15,23,42,.35)",
      cursor: "pointer",
      userSelect: "none",
    });
    label = document.createElement("span");
    pill.append(label);
    pill.addEventListener("click", () => void send());
    document.documentElement.append(pill);

    observer = new MutationObserver(scheduleRecount);
    observer.observe(document.body, { childList: true, subtree: true });
    recount();
  }

  function removePill() {
    observer?.disconnect();
    observer = null;
    pill?.remove();
    pill = null;
    label = null;
  }

  function sync() {
    const next = resolveSite();

    if (!next) {
      if (pill) removePill();
      site = null;
      return;
    }

    // Re-attach if the app's own rendering tore the pill out of the document.
    if (next !== site || !pill || !pill.isConnected) {
      removePill();
      site = next;
      createPill();
    }
  }

  // These apps navigate without a page load, and patching history from an
  // isolated world does not see the page's own calls, so poll the URL.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      sync();
      scheduleRecount();
    } else if (site && pill && !pill.isConnected) {
      sync();
    }
  }, 800);

  window.addEventListener("popstate", sync);

  if (document.body) sync();
  else document.addEventListener("DOMContentLoaded", sync, { once: true });
})();
