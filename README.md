# Worker-Owned Directory

A directory of worker-owned coffee shops and restaurants across the United States. Built with React, Vite, Tailwind CSS, and data from the U.S. Federation of Worker Cooperatives.

## Features

- Search by city, state, or business name
- Toggle between **Coffee Shops** (34) and **Restaurants** (27)
- Browse full listing page
- Clickable addresses linking to Google Maps
- Clean, minimal design inspired by yourfairshare.info

## Tech Stack

- **React 19** + **Vite** for the frontend
- **Tailwind CSS 4** for styling
- **Lucide React** for icons
- **Python HTTP server** for local preview

## Usage

```bash
npm install
npm run dev       # development server
npm run build     # production build
npm run preview   # preview production build
```

## Data

All shop data is in `src/data/shops.json`. Each entry has: name, city, state, location, website, and category (`coffee` or `restaurant`).

Sourced from the [USFWC Directory](https://www.usworker.coop/directory/) (474+ worker cooperatives).

## Current Coverage

- **75 total entries** across 25 states
- **51 coffee shops** — cafes, bakeries, roasters that serve coffee
- **24 restaurants** — restaurants, brewpubs, pizzerias, diners with full menus
- **Key states:** CA (25), MN (6), MA (5), MD (5), NY (5), OH (4), OR (3), VT (3), WA (2), VA (2), plus CO, CT, IA, KY, LA, ME, MI, NC, ND, OK, PA, RI, WI, and more

## Adding More Data

To add entries, edit `src/data/shops.json` with the schema:

```json
{ "id": 1, "name": "Shop Name", "city": "City", "state": "ST",
  "location": "Full Address", "website": "example.com", "category": "coffee" }
```

To build the site after changes: `npm run build`

## Preview

A Python HTTP server serves the built site on port 8090:

```bash
npm run build
python3 -m http.server 8090 --directory dist
```