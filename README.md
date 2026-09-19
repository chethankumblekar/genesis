# HouseHunting

A shared tracker and map for a Bengaluru 2 BHK hunt: gated society / apartment / service apartment, rent under ₹30,000, parking preferred, move-in around two months. Default areas are **HSR, Harlur, Kudlu, Koramangala, BTM**, plus Nearby.

Listings live in this browser (`localStorage`). There is no login and no database. Share progress with JSON export / import.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The dev server binds `0.0.0.0` on port **43123**.

Production:

```bash
npm run build
npm start -- --hostname 0.0.0.0 --port 43123
```

## Paste helper

Paste a public listing URL and/or a blob of notes, then **Extract metadata**. The `/api/paste` route fetches **only** Open Graph title, description, and image (plus the HTML `<title>`). A small heuristic then looks in that text for rent, deposit, BHK, locality, parking, and furnished.

Nothing is saved until you confirm **Review in form** and hit **Save listing**. Sites that block fetches (typical for Facebook Marketplace and many NoBroker pages) stay manual — paste the rent and area into notes instead. This app does not scrape those sites.

## Export and import

- **Export JSON** downloads `{ version: 1, exportedAt, listings }`.
- **Import** merges by listing `id` (incoming rows update matching ids and add new ones). Data stays on the machine that imported the file.

To reset this browser, clear site data for the app origin or remove the `househunting.listings.v1` key in DevTools.

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
