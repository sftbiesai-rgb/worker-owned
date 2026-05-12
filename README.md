# Worker-Owned Directory

A directory of worker-owned coffee shops and restaurants across the United States. Built with React, Vite, Tailwind CSS, and data from the U.S. Federation of Worker Cooperatives.

## Features

- Search by city, state, or business name
- Toggle between **Coffee Shops** (59) and **Restaurants** (32)
- Browse full listing page
- Submission form with math CAPTCHA anti-spam
- Red, white & blue theme inspired by yourfairshare.info
- Mobile-friendly card-based design

## Tech Stack

- **React 19** + **Vite** for the frontend
- **Tailwind CSS 4** for styling
- **Lucide React** for icons
- **Vercel Serverless Functions** (`/api/submit.js`) for form submission
- **Nodemailer** for email delivery (configure SMTP env vars for production)

## Usage

```bash
npm install
npm run dev       # development server
npm run build     # production build
npm run preview   # preview production build
```

## Vercel Deployment

This project is deployed on Vercel. The serverless function at `/api/submit.js` handles form submissions.

To enable email delivery, set these environment variables in Vercel:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@workerowned.com
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

## Data

All shop data is in `src/data/shops.json`. Each entry has: name, city, state, location, website, and category (`coffee` or `restaurant`).

Sourced from the [USFWC Directory](https://www.usworker.coop/directory/) (474+ worker cooperatives).

## Current Coverage

- **91 total entries** across 29 states
- **59 coffee shops** — cafes, bakeries, roasters that serve coffee
- **32 restaurants** — restaurants, brewpubs, pizzerias, diners with full menus
- **Key states:** CA (25), MN (7), MA (6), MD (6), NY (6), OH (4), OR (3), VT (3), WA (4), VA (2), PA (3), IL (1), RI (2), plus CO, CT, IA, KY, LA, ME, MI, NC, ND, OK, WI, and more

## Next Steps

- [ ] **Update logo / favicon** — replace the Your Fair Share icon with a custom coffee mug or co-op icon; update favicon to match
- [ ] **Post on Reddit co-op groups** — share on r/cooperatives, r/coffee, and city-specific subreddits to invite submissions from the community
- [ ] **Add Vercel Analytics / visit counters** — drop in the Vercel Analytics script or a simple counter to track page views
- [ ] **SEO optimization** — add meta descriptions, Open Graph tags, sitemap.xml, structured data (Schema.org) for local business listings
- [ ] **Add city/state pages** — generate static pages for each city/state with filtered results for better SEO
- [ ] **Add Google Maps integration** — embed a map view showing all worker-owned shops
- [ ] **Add category expansion** — include bakeries, grocery co-ops with cafes, breweries, etc.
- [ ] **Add user ratings / reviews** — let visitors leave feedback on listed businesses
- [ ] **Set up automated email notifications** — configure SMTP env vars in Vercel so submissions are emailed to sftbiesai@gmail.com

## Database Expansion Strategy

The USFWC directory (474 entries across all industries) has been fully scraped. Worker-owned food businesses are scattered and often not indexed on major search engines. To find more, try these approaches in order:

### 1. Regional Co-op Developer Directories (highest yield)
Each region has a co-op development organization with its own member directory. Many are not connected to USFWC:

| Organization | URL | Focus Area |
|---|---|---|
| Co-op Cincy | coopcincy.org/co-ops | Cincinnati / Ohio |
| NYC Network of Worker Co-ops | nycworker.coop/co-op-directory | New York City |
| Cooperation Texas | cooperationtexas.org | Texas |
| Project Equity | project-equity.org | National (conversions) |
| Valley Alliance of Worker Co-ops | vawc.org | Western Mass |
| Philadelphia Area Co-op Alliance | philadelphia.coop/directory | Philadelphia |
| Democracy at Work Institute | institute.coop | National |
| Seed Commons | seedcommons.org/our-network | National (lending) |
| Cooperative Fund of the Northeast | cooperativefund.org | Northeast |
| Shared Capital Cooperative | sharedcapital.coop | National (lending) |
| Eastern Conference for Workplace Democracy | ecwd.org | Eastern US |
| U.S. Federation of Worker Co-ops | usworker.coop/member-directory | National (member list) |

**How:** Visit each URL, look for member/co-op directory pages. Many use WordPress or custom JS that won't render via web fetch — you may need to manually browse and extract entries.

### 2. City-Specific Searches
Search for "worker owned coffee shop [city]" or "worker cooperative cafe [city]" for major cities not well represented:
- Austin, TX • Chicago, IL • Portland, OR • Seattle, WA • Denver, CO
- Atlanta, GA • Miami, FL • Washington DC • New Orleans, LA
- Detroit, MI • Philadelphia, PA • Pittsburgh, PA • Phoenix, AZ

### 3. News Articles About Co-op Conversions
Many worker co-ops form when an owner retires or a union drive happens. Search for:
- "converted to a worker cooperative" + coffee/cafe/restaurant
- "employees buy [cafe/restaurant]" + cooperative
- "worker-owned" + "grand opening" + cafe/coffee
- Search local news archives for specific cities

### 4. Co-op Ecosystem Sites
- **Yelp** — search for "worker cooperative" as a keyword in your city
- **Google Maps** — search for "worker-owned" near various cities
- **Instagram** — many worker co-ops use hashtags like #workerowned #workercoop #cooperative
- **LinkedIn** — search company descriptions for "worker-owned cooperative"

### 5. ESOP vs. Worker Co-op
Some employee-owned companies are ESOPs (Employee Stock Ownership Plans), not true worker co-ops. Verify each entry:
- Worker co-op = one worker, one vote, democratic governance
- ESOP = trust-owned, employees have indirect ownership
- Generally skip ESOPs unless the business also operates democratically

### 6. Systematic State-by-State Approach
If time allows, go state by state searching for:
- "worker cooperative [state] directory"
- "[state] worker co-op network"
- "cooperative development [state]"
- Check state government websites for co-op resources

### 7. Submit / Crowdsource
The submission form at `/submit` lets anyone nominate a business. Promote it on:
- r/cooperatives, r/coffee, r/anticonsumption
- City-specific subreddits
- Co-op mailing lists and forums
- Worker co-op Slack/Discord communities

### Target: 200+ entries
The US likely has 150-250 worker-owned coffee shops/cafes and 100-150 worker-owned restaurants. With systematic scraping of all regional directories, we should reach 200+.

## Adding More Data

To add entries, edit `src/data/shops.json` with the schema:

```json
{ "id": 1, "name": "Shop Name", "city": "City", "state": "ST",
  "location": "Full Address", "website": "example.com", "category": "coffee" }
```

To build the site after changes: `npm run build`

## Preview

```bash
npm run build
python3 -m http.server 8090 --directory dist
```
