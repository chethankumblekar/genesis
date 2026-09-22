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

  /** A single listing's own page, rather than a page of result tiles. */
  isDetail() {
    return /\/[0-9a-f]{28,34}\/detail/.test(location.pathname);
  },

  /**
   * Detail pages render a map, so the coordinates are in the page's embedded
   * JSON even though they never appear in the visible text. Read them from the
   * scripts; if the shape has changed, return nothing rather than a guess.
   */
  coords() {
    const html = document.documentElement.innerHTML;
    const pair = (a, b) => {
      const lat = html.match(new RegExp(`"${a}"\\s*:\\s*(-?\\d{1,3}\\.\\d{3,})`));
      const lng = html.match(new RegExp(`"${b}"\\s*:\\s*(-?\\d{1,3}\\.\\d{3,})`));
      if (!lat || !lng) return null;
      const out = { lat: Number(lat[1]), lng: Number(lng[1]) };
      // Bengaluru sanity check — never ship a coordinate from somewhere else.
      const sane =
        out.lat > 12.5 && out.lat < 13.5 && out.lng > 77.2 && out.lng < 78.0;
      return sane ? out : null;
    };
    return pair("latitude", "longitude") || pair("lat", "lon") || pair("lat", "lng");
  },

  /** One capture for the listing this page is about. */
  harvestDetail() {
    const id = location.pathname.match(/([0-9a-f]{28,34})\/detail/)?.[1];
    if (!id) return [];

    const main = document.querySelector("main") || document.body;
    const text = (main.innerText || "").trim().slice(0, 12000);
    if (!text) return [];

    const images = [...main.querySelectorAll("img")]
      .map((img) => img.src)
      .filter((src) => src && src.startsWith("http") && !src.endsWith(".svg"));

    const capture = {
      externalId: id,
      url: location.href.split("?")[0],
      text,
      imageUrls: [...new Set(images)].slice(0, 10),
      capturedAt: new Date().toISOString(),
      kind: "detail",
    };
    const c = this.coords();
    if (c) capture.coords = c;
    return [capture];
  },

  /**
   * Search-result cards carry the NoBroker property id as their DOM id — a
   * 32-char hex string. Verified against the live page 2026-09-20.
   */
  harvest() {
    if (this.isDetail()) return this.harvestDetail();

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
        kind: "card",
      });
    }

    return out;
  },
});
