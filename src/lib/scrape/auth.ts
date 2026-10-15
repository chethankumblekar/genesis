/**
 * The ingest route writes to the database and is reachable from any page the
 * browser has open, so it is token-gated. The token is shared with the
 * extension through its options page.
 */
export type AuthFailure = { error: string; status: number };

export function checkScrapeToken(request: Request): AuthFailure | null {
  const expected = process.env.SCRAPE_TOKEN?.trim();
  if (!expected) {
    return {
      error:
        "SCRAPE_TOKEN is not set on the server. Add it to .env and restart, then paste the same value into the extension options.",
      status: 503,
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (!provided || provided !== expected) {
    return { error: "Bad or missing scrape token.", status: 401 };
  }
  return null;
}

/** Only the extension itself may call this cross-origin; the token does the real work. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = /^chrome-extension:\/\/[a-p]{32}$/.test(origin) ? origin : "";
  return allowed
    ? {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin",
      }
    : {};
}
