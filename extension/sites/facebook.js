globalThis.HH = globalThis.HH || {};
HH.sites = HH.sites || [];

HH.sites.push({
  id: "facebook",
  label: "Facebook Marketplace",

  matches() {
    return (
      location.hostname.endsWith("facebook.com") &&
      location.pathname.startsWith("/marketplace")
    );
  },

  /**
   * Marketplace has no stable card container we can rely on, but every card is
   * an anchor to /marketplace/item/<id>. Walk up to the nearest ancestor that
   * holds the whole card's text.
   */
  harvest() {
    const byId = new Map();

    for (const anchor of document.querySelectorAll('a[href*="/marketplace/item/"]')) {
      const match = anchor.href.match(/\/marketplace\/item\/(\d+)/);
      if (!match) continue;
      const id = match[1];

      const text = (anchor.innerText || "").trim();
      if (!text) continue;

      // Keep the richest version of a card if it appears more than once.
      const existing = byId.get(id);
      if (existing && existing.text.length >= text.length) continue;

      // currentSrc first: Marketplace lazy-loads and swaps srcset entries.
      const images = [...anchor.querySelectorAll("img")]
        .map((img) => img.currentSrc || img.src || "")
        .filter((src) => src.startsWith("http"));

      byId.set(id, {
        externalId: id,
        url: anchor.href.split("?")[0],
        text,
        imageUrls: [...new Set(images)].slice(0, 8),
        capturedAt: new Date().toISOString(),
        kind: "card",
      });
    }

    return [...byId.values()];
  },
});
