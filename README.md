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

Port already in use:

```bash
APP_PORT=8080 docker compose up --build          # app at http://127.0.0.1:8080
DB_PORT=5433 docker compose up --build           # if something else is on 5432
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

## Paste helper

Paste a public listing URL and/or a blob of notes, then **Extract metadata**. The `/api/paste` route fetches **only** Open Graph title, description, and image (plus the HTML `<title>`). A small heuristic then looks in that text for rent, deposit, BHK, locality, parking, and furnished.

Nothing is saved until you confirm **Review in form** and hit **Save listing**. Sites that block fetches (typical for Facebook Marketplace and many NoBroker pages) stay manual — paste the rent and area into notes instead. This app does not scrape those sites.

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
