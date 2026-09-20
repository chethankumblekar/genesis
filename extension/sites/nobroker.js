// Content scripts from one extension share an isolated-world global, so each
// site module registers itself here and overlay.js picks the one that matches.
globalThis.HH = globalThis.HH || {};
HH.sites = HH.sites || [];

HH.sites.push({
  id: "nobroker",
  label: "NoBroker",

  matches() {
    return location.hostname.endsWith("nobroker.in");
  },

  /**
   * Search-result cards carry the NoBroker property id as their DOM id — a
   * 32-char hex string. Verified against the live page 2026-09-20.
   */
  harvest() {
    const seen = new Set();
    const out = [];

    for (const el of document.querySelectorAll("[id]")) {
      const id = el.id;
      if (!/^[0-9a-f]{28,34}$/.test(id) || seen.has(id)) continue;

      const text = (el.innerText || "").trim();
      // Real cards always show a rupee figure; skip stray hex-id containers.
      if (!text || !text.includes("₹")) continue;
      seen.add(id);

      const link = el.querySelector('a[href*="/detail"]') || el.querySelector("a[href]");
      const images = [...el.querySelectorAll("img")]
        .map((img) => img.src)
        .filter((src) => src && !src.includes("/List-Page/") && !src.endsWith(".svg"));

      out.push({
        externalId: id,
        url: link ? link.href : location.href,
        text,
        imageUrls: [...new Set(images)].slice(0, 6),
        capturedAt: new Date().toISOString(),
      });
    }

    return out;
  },
});
