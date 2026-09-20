# Listing scraper: browser extension + review queue

Date: 2026-09-20
Status: approved for implementation

## Problem

`POST /api/paste` fetches a listing URL server-side and runs
`extractListingCandidates` over the HTML. For the two sources that matter most
this never worked, and the README's framing of why is wrong:

- **NoBroker** returns a ~50KB single-page-app shell with **zero listing data**,
  regardless of User-Agent. The README says NoBroker "often blocks automated
  reads"; it does not block, it simply renders client-side. No amount of header
  tuning fixes this.
- **Facebook Marketplace** returns HTTP 400 to server-side fetches. The code
  already skips it (`FRAGILE_HOSTS`, `skip: true`).

So the only import path that works today is the user retyping listing text by
hand. The goal is genuine capture from both sources.

## Findings from the 2026-09-20 spike

Measured, not assumed:

| Probe | Result |
| --- | --- |
| NoBroker search, server fetch, app UA | 200, 50KB shell, no listings |
| NoBroker search, server fetch, browser UA | 200, 50KB shell, no listings |
| `GET /api/v3/property/filter/` | **200 JSON, no login, no bot wall**; param shape not yet known (guesses return `"No property found"`) |
| NoBroker search, real browser | **555 card nodes, 25 unique listings/page**, full text + canonical URL + stable property id |
| FB Marketplace, server fetch | 400 |
| FB Marketplace, real browser, logged out, `latitude`/`longitude` params | Works. Real Bengaluru rentals in rupees, 24 items |
| FB Marketplace, logged out, scroll for more | **Signup wall.** Cards vanish, registration tab opens |

A representative NoBroker card, extracted from the live DOM:

```
2 BHK House For Rent In Hsr Layout
Independent House, Sector 7, Near Golden Arch Montessori School
₹ 10,000  Rent   ₹40,000 Deposit   800 sqft Builtup
Semi Furnished   2 BHK   Family   Ready to Move
```

That maps onto `Listing` nearly field-for-field.

Two consequences drive the whole design:

1. **A real browser is required.** Server-side HTTP is confirmed useless for
   both sites. This is a rendering and session problem, not a header problem.
2. **A logged-in human session beats automation.** FB's scroll wall is the
   binding constraint, and it disappears entirely when the person scrolling is
   the logged-in user. Nothing in this design fights anti-bot, because nothing
   in it is a bot: it harvests pages the user has already loaded themselves.

## Non-goals

- **Scheduled / unattended crawling.** An extension cannot do it. If wanted
  later, a local Playwright worker can be added; it will POST to the same
  ingest API, so this design does not block it.
- **Bypassing any anti-bot wall, login wall, or CAPTCHA.** Explicitly out.
- **Hosting the extension in the Chrome Web Store.** Loaded unpacked, locally.

## Architecture

Four pieces. The extension captures; the server parses, scores, and stores; the
user promotes.

```
Chrome (user logged in, page already open)
  └── extension/  content script  ──POST raw captures──▶  /api/scrape/ingest
                                                              │ normalize (heuristics.ts)
                                                              │ score (junk filter)
                                                              ▼
                                                         scraped_listings
                                                              │ user reviews
                                                              ▼ promote
                                                          listings  (existing upsertListing)
```

### 1. Extension captures raw; the server parses

Content scripts send raw text, URL, external id, and image URLs per card. They
do **no** rent/area/BHK parsing.

Rationale: parsing stays in `src/lib/heuristics.ts`, which already handles
Bengaluru area aliases, `k`-suffixed rents, deposits, and furnishing, and is
already under test. One source of truth, and fixing a parser is an app edit
rather than an extension reload. It also keeps the extension small enough to
audit by reading it.

```
extension/
  manifest.json      MV3. host_permissions: nobroker.in, facebook.com. storage.
  sites/nobroker.js  DOM → RawCapture[]
  sites/facebook.js  DOM → RawCapture[]
  overlay.js         floating "Import N listings" pill on matching pages
  options.html/.js   app base URL (default http://127.0.0.1:43123) + token
```

`RawCapture`:

```ts
type RawCapture = {
  externalId: string;   // NoBroker property id, or FB marketplace item id
  url: string;          // canonical listing URL
  text: string;         // card innerText, newlines preserved
  imageUrls: string[];
  capturedAt: string;   // ISO
};
```

Selectors, both verified live on 2026-09-20:

- NoBroker: elements whose `id` matches `/^[0-9a-f]{28,34}$/`; canonical URL
  from the descendant `a[href*="/detail"]`.
- Facebook: `a[href*="/marketplace/item/"]`; id from `/item\/(\d+)/`; card text
  from the anchor's `innerText`.

Selectors will rot. They are isolated to one file per site, and a harvest that
finds zero cards must surface "couldn't read this page" in the overlay rather
than failing silently.

### 2. Storage: a review queue, separate from the board

```sql
CREATE TABLE IF NOT EXISTS scraped_listings (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  url          TEXT NOT NULL DEFAULT '',
  raw          JSONB NOT NULL,
  draft        JSONB NOT NULL,
  confidence   TEXT NOT NULL,          -- high | medium | low
  status       TEXT NOT NULL,          -- pending | imported | rejected
  captured_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (source, external_id)
);
```

Added to `SCHEMA_SQL` in `src/lib/db.ts`, which is already idempotent
`CREATE TABLE IF NOT EXISTS` run via `ensureSchema()`. No migration tool needed.

Nothing reaches `listings` until the user promotes, matching the existing
"nothing is saved until you hit Save listing" behaviour.

### 3. Dedupe

`UNIQUE (source, external_id)` using the stable ids both sites expose. On
re-harvest:

- `pending` row → update `raw`, `draft`, `captured_at`
- `imported` or `rejected` row → **skip untouched**

So rejected junk never resurfaces, and re-scanning a search page you have
already triaged is a no-op.

### 4. Junk filter (Facebook only)

FB's `propertyrentals` category mixes in goods: `₹600 Wooden railing`,
`₹140 M FURNITURE` appeared beside genuine flats in the spike.

Score, do not drop:

- no BHK detected **and** rent < ₹5,000 → `low`
- goods keywords (furniture, railing, sofa, curtain, interior, ...) → `low`
- rent + area + BHK all parsed → `high`; otherwise `medium`

`low` rows are stored but collapsed in the review sheet behind
"show N filtered". A misfiring heuristic is then recoverable instead of
silently eating a real listing.

### 5. API

| Route | Purpose |
| --- | --- |
| `POST /api/scrape/ingest` | `{ source, items: RawCapture[] }` → normalize, score, upsert. Returns per-item `added / updated / skipped`. |
| `GET /api/scrape/pending` | Pending rows for the review tray. |
| `POST /api/scrape/[id]/promote` | Body may carry user edits. Calls existing `upsertListing()`, marks row `imported`. |
| `POST /api/scrape/[id]/reject` | Marks row `rejected`. |

### 6. Auth

`/api/scrape/ingest` writes to the database and, without a check, is reachable
from any page the browser visits. It requires a bearer token from
`SCRAPE_TOKEN` (added to `.env.example`), set in extension options. Requests
without a matching token get 401. Response CORS is restricted to the
extension's own origin.

### 7. UI

A tray in `src/components/hunt-app.tsx`: *"12 new from NoBroker"*, opening a
sheet of candidates. Each row offers **Import**, **Reject**, or **Edit in
form** — the last reusing the existing `listing-form.tsx` rather than
introducing a second editor. Low-confidence rows collapsed behind a
"show N filtered" toggle.

## Error handling

| Case | Behaviour |
| --- | --- |
| Harvest finds 0 cards | Overlay says the page could not be read, names the site, does not POST |
| App unreachable / wrong port | Overlay shows the failure and the configured URL; captures are not lost until a retry succeeds |
| 401 from ingest | Overlay tells the user to set the token in options |
| Card parses to no rent **and** no BHK | Stored `low`, never dropped |
| Duplicate external id | Per rules above; response says `skipped` so the overlay can report "8 new, 17 already seen" |
| Malformed JSON body | 400, consistent with `/api/paste` |

## Testing

Follows the existing pattern — `npx tsx --test`, pure functions, no network.

- `src/lib/scrape/normalize.test.ts` — fixtures captured from the real DOM on
  2026-09-20: the HSR ₹10,000 / ₹40,000 / 800 sqft / Semi Furnished card, the
  FB `₹20,000 1BHK Bengaluru, KA` card, and the `₹600 Wooden railing` junk case.
  Asserts field extraction and confidence scoring.
- `src/lib/scrape/dedupe.test.ts` — pending updates, imported/rejected skip.
- Extension DOM readers tested against saved HTML fixtures, not live pages.

`npm test` currently runs a single file; it grows to run the `src/lib/**` test
files.

## Sequencing

1. Schema + repo + normalize/score, with tests. No UI, no extension.
2. Ingest API + auth. Verifiable with `curl`.
3. Extension for NoBroker only, end to end.
4. Review tray UI.
5. Facebook site module + junk filter.

Each step is independently verifiable, and step 1-2 can be proven before any
extension exists.

## Open question, deferred

`/api/v3/property/filter/` answers 200 JSON with no login and no bot wall. If
its parameter shape is captured during implementation, NoBroker collapses to a
cheap server-side JSON poll and only Facebook needs the browser — which would
also restore unattended scheduled crawling for NoBroker. Worth one capture
session, but the extension path does not depend on it.

## Legal / ToS note

Both sites' terms prohibit automated collection. This design deliberately
stays on the defensible side of that line: it reads pages the user has already
loaded in their own logged-in browser, at human pace, for personal use, and
bypasses no wall. Unattended server-side crawling of these two sites was
considered and rejected on that basis as well as on the technical evidence.
