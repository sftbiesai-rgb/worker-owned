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

- **101 total entries** across 29 states
- **64 coffee shops** — cafes, bakeries, roasters that serve coffee
- **37 restaurants** — restaurants, brewpubs, pizzerias, diners with full menus
- **Key states:** CA (26), NY (9), MA (7), MD (6), MN (6), OH (6), NC (4), OR (4), WA (4), ME (3), plus CO, CT, DC, GA, IA, IL, KY, LA, MI, ND, NM, OK, PA, RI, TN, VA, VT, WI, WV

## Next Steps

- [x] **Update logo / favicon** — replaced with custom coffee mug / co-op icon
- [ ] **Post on Reddit co-op groups** — share on r/cooperatives, r/coffee, and city-specific subreddits to invite submissions from the community
- [ ] **Add Vercel Analytics / visit counters** — drop in the Vercel Analytics script or a simple counter to track page views
- [ ] **SEO optimization** — add meta descriptions, Open Graph tags, sitemap.xml, structured data (Schema.org) for local business listings
- [ ] **Add city/state pages** — generate static pages for each city/state with filtered results for better SEO
- [ ] **Add Google Maps integration** — embed a map view showing all worker-owned shops
- [ ] **Add category expansion** — include bakeries, grocery co-ops with cafes, breweries, etc.
- [ ] **Add user ratings / reviews** — let visitors leave feedback on listed businesses
- [ ] **Set up automated email notifications** — configure SMTP env vars in Vercel (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SUBMISSIONS_EMAIL`)

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

### Long-Term Vision: Multi-Sector Directory
The ultimate goal is to expand beyond food & beverage into a comprehensive directory of **all worker-owned businesses** across the US, including:

- **Clothing & Apparel** — worker-owned clothing brands, textile co-ops, tailor shops
- **Bookstores** — worker-owned bookshops and radical literature distributors
- **Home & Garden** — worker-owned landscaping, cleaning, handyperson services
- **Healthcare & Wellness** — worker-owned clinics, therapy collectives, fitness co-ops
- **Childcare & Education** — worker-owned daycare centers, tutoring co-ops, schools
- **Retail & Grocery** — worker-owned markets, food co-ops, general stores
- **Tech & Media** — worker-owned软件开发, design studios, publishing co-ops
- **Manufacturing & Trades** — worker-owned factories, construction, breweries

Each sector would get its own data file (`src/data/shops.json` → `src/data/` directory), category toggle, and filtered search. The USFWC directory (474+ entries across all industries) provides a foundation — once the food sector is mature, the same scraping and verification workflow can be applied sector by sector.

### Long-Term Vision: Multi-Sector Directory
The ultimate goal is to expand beyond food & beverage into a comprehensive directory of **all worker-owned businesses** across the US, including:

- **Clothing & Apparel** — worker-owned clothing brands, textile co-ops, tailor shops
- **Bookstores** — worker-owned bookshops and radical literature distributors
- **Home & Garden** — worker-owned landscaping, cleaning, handyperson services
- **Healthcare & Wellness** — worker-owned clinics, therapy collectives, fitness co-ops
- **Childcare & Education** — worker-owned daycare centers, tutoring co-ops, schools
- **Retail & Grocery** — worker-owned markets, food co-ops, general stores
- **Tech & Media** — worker-owned软件开发, design studios, publishing co-ops
- **Manufacturing & Trades** — worker-owned factories, construction, breweries

Each sector would get its own data file (`src/data/shops.json` → `src/data/` directory), category toggle, and filtered search. The USFWC directory (474+ entries across all industries) provides a foundation — once the food sector is mature, the same scraping and verification workflow can be applied sector by sector.

### Dollar-Efficient OpenRouter Model Recommendations

These are the most cost-effective models on [OpenRouter](https://openrouter.ai) for each database expansion task as of May 2026. Prices are per token (prompt / completion). The **Can Execute?** column indicates whether the model can truly complete the task end-to-end, or if it can only generate a plan/markdown that a human (or another tool) must then carry out.

| Task | Recommended Model | Can Execute? | Why | Cost / 1K tokens |
|---|---|---|---|---|
| **1. Scraping regional directories** (extracting entries from ~12 co-op directory sites) | `openrouter/free` or `mistralai/mistral-nemo` | **No** — human must visit each URL, copy-paste raw page text. Model then extracts structured data from pasted text. Most sites use WordPress/custom JS that no LLM can scrape directly. | Bulk extraction of structured output from human-pasted text. Free tier handles it; Mistral Nemo is the cheapest paid fallback at $0.02/M prompt. | **$0** / $0.02/M |
| **2. City-specific search queries** (generating search strings for 13+ cities) | `openrouter/free` | **No** — generates search query strings in markdown for a human to paste into Google. Cannot execute searches or visit result pages. | Trivially simple text generation. Any model works. | **$0** |
| **3. News article discovery & analysis** (finding co-op conversion articles, extracting business names/locations) | `openai/gpt-4o-mini-search-preview` | **Yes** — built-in web search lets it find articles, read them, and extract business info in one call. The only model on this list that can independently browse the web. | End-to-end capability: search, read, summarize, extract. 128K context fits full articles. | $0.15 / $0.60 |
| **4. Co-op ecosystem site analysis** (parsing Yelp, LinkedIn, Google Maps results) | `deepseek/deepseek-v4-flash` | **No** — Yelp, Google Maps, LinkedIn, Instagram all require JS rendering, login sessions, or API keys. Model can only analyze text a human copy-pastes from these sites. | Once a human pastes content, the 1M context window handles entire pages. Excellent structured output at $0.13/M prompt. | $0.13 / $0.25 |
| **5. ESOP vs Worker Co-op verification** (nuanced classification of business ownership structures) | `openai/gpt-4o-mini` or `deepseek/deepseek-v4-flash` | **Yes** — if you provide the business description or website text, the model genuinely classifies it as ESOP, worker co-op, or neither. No external action needed. | Needs strong reasoning about co-op governance vs ESOP. GPT-4o-mini is most reliable; DeepSeek V4 Flash is 2x cheaper. | $0.15 / $0.60 (or $0.13/$0.25) |
| **6. State-by-state systematic searching** (generating 50-state search strategies) | `openrouter/free` | **No** — generates search strategy templates in markdown for a human to use. Cannot execute 50 separate searches or compile results. | Simple template-based query generation. Any model works. | **$0** |
| **7. Crowdsource promotion content** (writing Reddit posts, Slack messages, mailing list copy) | `google/gemini-2.0-flash-lite-001` or `deepseek/deepseek-v4-flash:free` | **Yes** — model writes human-quality promotional copy end-to-end. No further tooling needed. Paste the output into Reddit/Discord directly. | Needs decent prose quality. Gemini 2.0 Flash Lite is $0.07/M prompt — cheapest capable model for human-quality writing. | $0.07 / $0.30 (or **$0**) |
| **8. Data entry / JSON formatting** (structuring extracted entries into schema) | `mistralai/mistral-nemo` or `openrouter/free` | **Yes** — given unstructured business info, model outputs valid JSON matching the shops.json schema. One-shot, no iteration needed. | Strict JSON output, zero creativity. Cheapest paid or free. | $0.02 / $0.03 |
| **9. Multi-sector expansion** (categorizing 474+ USFWC entries into 8 sectors) | `deepseek/deepseek-v4-flash` | **Yes** — given the full list of 474 businesses, the 1M context fits the entire dataset. Model classifies each into one of 8 sectors in a single pass. | Bulk classification at scale. $0.13/M prompt makes it economical even for hundreds of entries. | $0.13 / $0.25 |
| **10. QC / Data quality check** (validate entries for missing fields, bad URLs, duplicates) | `deepseek/deepseek-v4-flash` | **Yes** — give it the candidate entries JSON and it flags data quality issues automatically. 1M context fits hundreds of entries in one pass. | Validates every field, catches typos in city/state, flags malformed websites, detects duplicates. | $0.13 / $0.25 |
| **11. Website & business status verification** (check URLs resolve; verify shops are still open) | Hybrid (Node.js `fetch` + `deepseek/deepseek-v4-flash`) | **Yes** — script fetches each URL (HTTP check), extracts page text, then LLM analyzes for closure signals. Fully automated. | Two-pass: (1) code checks HTTP status, (2) LLM reads page snippets for "permanently closed" signals. | ~$0.13/M for LLM pass + free HTTP checks |

**Key takeaway:** Only task **#3 (news discovery)** benefits from a search-augmented model that can independently browse. Tasks **#5, #7, #8, #9, #10, and #11** are fully executable by the model/script once you provide the input data. Tasks **#1, #2, #4, and #6** will still require a human to visit websites, copy-paste content, or execute search queries — the model can only generate a markdown plan or extract data from human-supplied text. For these, use the cheapest/free model since the bottleneck is human time, not model capability.

**Automated pipeline script:** `scripts/or-pipeline.mjs` routes each task to the cheapest model automatically. Run with:
```bash
OPENROUTER_API_KEY=sk-xxx npm run or-pipeline <task-id> [input...]
```
See `npm run or-pipeline -- --help` for all 11 task IDs. The script handles stdin, file input, and CLI args. Task 11 is a hybrid — it checks URLs with HTTP requests then analyzes page content with an LLM, all in one run.

**Full runbook:** `RUNBOOK.md` walks through the entire workflow phase by phase — discovery, classification, QC, verification, production merge, and crowdsource — with exact commands for each step.

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
