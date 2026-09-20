(() => {
  const site = (globalThis.HH?.sites || []).find((s) => s.matches());
  if (!site) return;

  const PILL_ID = "hh-import-pill";
  if (document.getElementById(PILL_ID)) return;

  const pill = document.createElement("div");
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

  const label = document.createElement("span");
  pill.append(label);
  document.documentElement.append(pill);

  let busy = false;
  let count = 0;

  const setLabel = (text, tone) => {
    label.textContent = text;
    pill.style.background =
      tone === "error" ? "#7f1d1d" : tone === "done" ? "#065f46" : "#0f172a";
  };

  const recount = () => {
    if (busy) return;
    try {
      count = site.harvest().length;
    } catch {
      count = 0;
    }
    setLabel(
      count ? `Import ${count} listing${count === 1 ? "" : "s"}` : "No listings on this page"
    );
    pill.style.cursor = count ? "pointer" : "default";
  };

  pill.addEventListener("click", async () => {
    if (busy) return;

    const items = site.harvest();
    if (!items.length) {
      // Never POST an empty harvest — that is a broken selector, not an empty page.
      setLabel("Couldn't read this page", "error");
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
        const { added = 0, updated = 0, skipped = 0 } = reply.counts || {};
        const parts = [`${added} new`];
        if (updated) parts.push(`${updated} updated`);
        if (skipped) parts.push(`${skipped} already seen`);
        setLabel(parts.join(", "), "done");
      }
    } catch (err) {
      setLabel(err?.message || "Import failed", "error");
    } finally {
      busy = false;
      setTimeout(recount, 4000);
    }
  });

  recount();

  // Both sites load more cards as you scroll; keep the count honest without
  // hammering the DOM on every scroll event.
  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(recount, 600);
  };
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
