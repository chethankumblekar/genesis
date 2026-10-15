# HouseHunting

A shared tracker and map for a Bengaluru 2 BHK hunt: gated society / apartment / service apartment, rent under ₹30,000, parking preferred, move-in around two months. Default areas are **HSR, Harlur, Kudlu, Koramangala, BTM**, plus Nearby.

Listings are stored in **Postgres**. JSON export / import remains a backup.

## Run on your computer (Docker Desktop)

Nothing from the cloud agent shows up in **your** Docker Desktop. You have to start the stack on this machine.

1. Install and **start** [Docker Desktop](https://docs.docker.com/get-started/get-docker/) (whale icon in the menu bar / tray).
2. In a terminal, from this repo:

```bash
git clone https://github.com/chethankumblekar/genesis.git
cd genesis
git checkout main
git pull
docker compose up --build
```

If you already cloned:

```bash
cd genesis
git checkout main
git pull
docker compose up --build
```

3. Wait until you see `househunting-app-1` and `househunting-db-1` as **Running** in Docker Desktop → **Containers**.
4. Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Stop with Ctrl+C in that terminal, or click Stop in Docker Desktop. Wipe data with `docker compose down -v`.

If Docker Desktop **Start** fails with `127.0.0.1:5432 … address already in use`, a local Postgres already owns 5432. Do not click Start on the old stack. Recreate so the db publishes **5433** (Compose default):

```bash
docker compose down
git pull
docker compose up --build
```

Other host ports:

```bash
APP_PORT=8080 docker compose up --build          # app at http://127.0.0.1:8080
DB_PORT=5434 docker compose up --build           # if 5433 is also taken
```

## Run locally (Node.js)

Postgres must be running. Easiest:

```bash
docker compose up db -d
cp .env.example .env
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The app binds `0.0.0.0` on port **43123**.

Production (recommended for a stable preview without the full Compose app image):

```bash
docker compose up db -d
npm run build
npm start
```

## Find listings

**Find listings** pastes a public URL and/or listing text, then shows a **ranked list of guesses** (not a silent one-shot fill). Pick a row, check the field preview, then **Review in form**. Nothing is saved until you hit **Save listing**.

What we read from a public page, in order:

1. JSON-LD (`RealEstateListing`, apartments, item lists)
2. Embedded page JSON (`__NEXT_DATA__` and `application/json` script tags)
3. Open Graph / Twitter title, description, and image, plus visible text
4. Your notes, including several listings split by `---`, numbered items, or extra `2 BHK` blocks

Each option shows a confidence (high / medium / low), which fields were filled, and what is still missing.

Pasting a **NoBroker or Facebook Marketplace URL does not work**, and no header tuning fixes it: NoBroker serves a JavaScript shell with no listing data in it, and Facebook returns `400` to anything that is not a browser. Use the importer extension for those two.

## Import from your browser (NoBroker, Facebook Marketplace)

`extension/` is an unpacked Chrome extension. It reads listings from pages **you** have already opened and sends them to this app. It does not crawl, schedule, or log in on your behalf, and it bypasses nothing — on Facebook you stay logged in and scroll yourself.

1. Add `SCRAPE_TOKEN=<any string>` to `.env` and restart the app.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, pick the `extension/` folder.
3. Open the extension's **Details → Extension options** and paste the same token. The app URL defaults to `http://127.0.0.1:43123`.
4. Browse a search on NoBroker or Facebook Marketplace. A pill appears bottom-right: **Import 25 listings**. Click it.
5. Back in the app, a **N captured** button appears in the header. Review each one, then **Import**, **Edit in form**, or **Reject**.

### Importing one listing

Open a listing's own page on NoBroker and the pill reads **Import this listing**
instead. A detail page carries things the search tiles do not — most usefully
map coordinates, which is what puts a pin on your map.

### Only importing what you want

Extension options has a **What to import** section: tick the bedroom counts you
want and set a rent range. Listings that do not match are never sent to your
board, and the pill reports how many it dropped ("12 new, 8 filtered out").

The filter runs in the app after parsing, not in the extension, so it matches on
the real rent and BHK rather than a second guess at them. Listings whose rent
cannot be read — leases, mostly — are kept regardless, so they still reach the
review tray instead of vanishing.

Nothing reaches your board until you import it. Re-running the import on a page you have already reviewed is a no-op — listings you rejected stay rejected.

Facebook's rental category mixes in furniture and goods, so obvious non-rentals are scored low and collapsed behind **Show N filtered** rather than dropped, in case the filter is wrong.

## Where the database lives

The stack uses **no Docker volumes at all**. Postgres writes to `./data/postgres`
on your disk, bind-mounted into the `db` container, and the app reaches the
database over the compose network rather than a shared socket. Point the data
somewhere else — an external drive, say — with `PG_DATA_DIR`:

```bash
PG_DATA_DIR=/Volumes/MyDrive/househunting-pg docker compose up --build
```

The directory is gitignored. `docker compose down -v` has nothing left to
delete, so it can no longer take your listings with it. To wipe the database,
delete the directory yourself.

### Migrating off the old Docker volume

Earlier versions kept the data in a Docker volume. Compose prefixes volume
names with the project name, so the volume is `househunting_househunting_pg` —
check yours with `docker volume ls` rather than assuming.

If you have listings from before this change, copy them across **once**, before
starting the stack again — otherwise Postgres initializes an empty database in
the new directory and your listings will look like they vanished. They are not
gone; they are still in the old volume until you delete it.

```bash
docker compose down
docker run --rm \
  -v househunting_househunting_pg:/from \
  -v "$PWD/data/postgres:/to" \
  alpine sh -c 'cp -a /from/. /to/'
docker compose up -d
```

Check your listings are there, and only then reclaim the old volume:

```bash
docker volume rm househunting_househunting_pg
```

Note that `docker run -v` **creates** a volume that does not exist rather than
failing, so a wrong name here copies nothing and leaves you with an empty
database and a stray volume. Confirm the name in `docker volume ls` first.

## Export and import

- **Export JSON** downloads `{ version: 1, exportedAt, listings }`.
- **Import** merges by listing `id` (incoming rows update matching ids and add new ones) and writes the result to Postgres.

If this browser still has old `localStorage` listings and the database is empty, they are imported once on first load.

## Map

Leaflet tiles from OpenStreetMap, centered on South Bengaluru. Pins are colored by status. **Locate** on the form geocodes address / landmark / area via Nominatim (server route `/api/geocode`). Listings without coordinates still appear on the board.

Area chips filter the board and pan the map. Toggle a chip off to stop filtering that area; with none selected, every area is shown.

## Field meanings

| Field | Meaning |
| --- | --- |
| Society or building | Building / society name as you would say it to a broker |
| Address or landmark | Enough to find it (gate, road, “near Kudlu Gate”) |
| Area | HSR, Harlur, Kudlu, Koramangala, BTM, or Nearby |
| Rent / deposit | Monthly rent and security deposit in INR |
| BHK | Defaults to 2 |
| Type | Gated society, apartment, or service apartment |
| Parking | Yes / no / unknown. **Parking preferred** hides “no parking” only |
| Available from | Target move-in date |
| Source | NoBroker, Facebook, broker, Housing, 99acres, other |
| URL | Public listing link |
| Contact | Owner or broker phone / WhatsApp |
| Photo URLs | One image URL per line (no file hosting in v1) |
| Notes | Freeform: backup hours, visit slot, red flags |
| Furnished / floor / power backup | Optional, for later filters |
| Latitude / longitude | Map pin; filled by Locate or on save |
| Status | New → Contacted → Visit booked → Visited → Shortlisted / Rejected |

**Max rent** defaults to ₹30,000. Listings above that stay visible and are flagged **Over budget**.
