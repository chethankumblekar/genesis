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

  /**
   * The results page plots every card on its map, so each property's
   * coordinates are in the page JSON even though no card shows them. Find the
   * property id, then look for a lat/lng pair close to it. Returns a Map of
   * id -> coords, and simply omits anything it cannot find or trust.
   */
  coordsByIdFromPage(ids) {
    const html = document.documentElement.innerHTML;
    const found = new Map();
    const NUM = "(-?\\d{1,3}\\.\\d{3,})";

    for (const id of ids) {
      let from = 0;
      while (found.size < ids.length) {
        const at = html.indexOf(id, from);
        if (at < 0) break;
        from = at + id.length;

        // Look FORWARD only, and not far. Scanning backwards reaches into the
        // previous listing's JSON and silently assigns its coordinates to this
        // card -- wrong coordinates are far worse than none, so a miss here is
        // the safe outcome.
        let window = html.slice(at, at + 600);

        // Stop at the next property id: past that point any coordinates belong
        // to a different listing, so a card with none must come back empty
        // rather than borrowing its neighbour's.
        let edge = window.length;
        for (const other of ids) {
          if (other === id) continue;
          const o = window.indexOf(other);
          if (o >= 0 && o < edge) edge = o;
        }
        window = window.slice(0, edge);
        const lat =
          window.match(new RegExp(`"lat(?:itude)?"\\s*:\\s*${NUM}`)) || null;
        const lng =
          window.match(new RegExp(`"l(?:ng|on|ongitude)"\\s*:\\s*${NUM}`)) || null;
        if (!lat || !lng) continue;

        const c = { lat: Number(lat[1]), lng: Number(lng[1]) };
        if (c.lat > 12.5 && c.lat < 13.5 && c.lng > 77.2 && c.lng < 78.0) {
          found.set(id, c);
          break;
        }
      }
    }
    return found;
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

      // Photos live on images.nobroker.in and are named after the property id.
      // Everything else in the card is site furniture -- button icons, logos.
      // The app filters again; this just avoids shipping obvious junk.
      const images = [...el.querySelectorAll("img")]
        .map((img) => img.currentSrc || img.src || img.dataset.src || "")
        .filter((src) => src.startsWith("http"))
        .filter((src) => !/\/nb-new\/public\/|assets\.nobroker\.in|\/static\/img\/|\.svg(?:$|\?)/i.test(src));

      out.push({
        externalId: id,
        url: link ? link.href : location.href,
        text,
        imageUrls: [...new Set(images)].slice(0, 8),
        capturedAt: new Date().toISOString(),
        kind: "card",
      });
    }

    // One pass over the page for every card's coordinates, rather than per card.
    if (out.length) {
      const coords = this.coordsByIdFromPage(out.map((c) => c.externalId));
      for (const capture of out) {
        const c = coords.get(capture.externalId);
        if (c) capture.coords = c;
      }
    }

    return out;
  },
});
