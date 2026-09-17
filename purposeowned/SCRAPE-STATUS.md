# Purpose Owned — Scrape Status (2026-09-17)

## Site
- **Live at**: https://purposeowned.vercel.app
- **Location**: `purposeowned/site/` (Vite + React + Tailwind)
- **Currently showing**: 26,519 products from 93 stores (B Corp Shopify + WooCommerce)

## Data Sources

### 1. B Corps (bcorporation.net) — DONE
- **Source**: Typesense API at bcorporation.net
- **Raw data**: `bcorp_us_companies.json` (3,407 US B Corps)
- **Filtered**: `bcorp_us_hq_ecommerce.json` (593 consumer/retail candidates, 584 with websites)
- **E-commerce detected**: 206 stores
  - Shopify: 89 (82 found via sitemap)
  - WooCommerce: 26
  - Squarespace: 14
  - BigCommerce: 7
  - Magento: 4
  - Unknown: 66

#### Shopify scraping — DONE
- 80/82 stores scraped, 25,051 products
- Method: `/products.json?limit=250&page=N` pagination
- Saved: `bcorp_products.json` (merged Shopify + WooCommerce = 26,519 products)
- Also: `bcorp_products_blocked.json` (rescrape results, already merged)

#### WooCommerce scraping — DONE
- 13/26 stores had products, 1,468 products total
- Method: Store API (`/wp-json/wc/store/products`) + sitemap HTML fallback
- Saved: `bcorp_products_woocommerce.json`
- Already merged into `bcorp_products.json`

#### Not yet scraped from B Corps:
- Squarespace: 14 stores
- BigCommerce: 7 stores
- Unknown platform: 66 stores

### 2. Benefit Corporations (domoregood.com) — IN PROGRESS
- **Source**: Google Sheets CSV at domoregood.com/benefit-corporation-directory
- **Raw data**: `benefit_corps.json` (2,090 in good standing out of 10,311 total)
- **Websites found**: 1,735 (83%) via domain guessing
- **E-commerce detected**: `benefit_corps_ecommerce.json` (419 stores)
  - New (not overlapping B Corps): 388
  - Shopify: 50 new, WooCommerce: 108 new, Squarespace: 14, BigCommerce: 3, Unknown: 213

#### Benefit Corp Shopify scraping — DONE
- 22 stores with products (4 false positives filtered: Brighton, Champion, Boondockers, Love Foundation; also Lafe's, Dolphin Blue)
- 2,476 products
- Saved: `benefit_corps_products_shopify.json`
- **NOT YET merged into main products or deployed to site**

#### Benefit Corp WooCommerce scraping — IN PROGRESS (running at shutdown)
- Script: `/tmp/bcorp_scrape_benefit_woo.py`
- 108 stores to scrape
- PID was running at shutdown; output file `benefit_corps_products_woo.json` not yet saved
- **NEEDS TO BE RE-RUN** — the script is at `/tmp/bcorp_scrape_benefit_woo.py`

#### Not yet scraped from benefit corps:
- Squarespace: 14 stores
- BigCommerce: 3 stores  
- Unknown platform: 213 stores

### 3. Purpose Pledge — NOT STARTED
- Source: https://www.purposepledge.org/companies
- Only 20 companies, Squarespace site

### 4. Purpose Trusts (Mark's data) — NOT STARTED
- Source: https://trustownership.notion.site/business-directory
- Notion page, needs JS rendering or ask Mark for data directly

### 5. Steward-owned (purpose-economy.org) — NOT STARTED
- Source: https://purpose-economy.org/en/companies/
- 43 companies, WordPress REST API available
- Mostly European (Patagonia, Ecosia, etc.)

### 6. 100% for Purpose — NOT STARTED
- Source: https://100forpurpose.org/
- Only 11 companies (Newman's Own, Patagonia, Ecosia, Mozilla, etc.)

## Scripts (in /tmp — may be lost on restart)
- `/tmp/bcorp_shopify_scrape.py` — Sitemap-based Shopify scraper (B Corps)
- `/tmp/bcorp_scrape_blocked.py` — /products.json pagination scraper for blocked stores
- `/tmp/bcorp_scrape_woocommerce.py` — WooCommerce scraper (B Corps)
- `/tmp/bcorp_benefit_corps.py` — Benefit corp directory pull + website finding + ecommerce detection
- `/tmp/bcorp_scrape_benefit_shopify.py` — Benefit corp Shopify scraper
- `/tmp/bcorp_scrape_benefit_woo.py` — Benefit corp WooCommerce scraper (needs re-run)
- `/tmp/bcorp_find_shopify.py` — Early Shopify finder via /products.json
- `/tmp/bcorp_triage_ecommerce.py` — E-commerce triage script
- `/tmp/bcorp_last40.py` — URL fixer for last 40 missing websites

## Next Steps
1. Re-run benefit corp WooCommerce scraper (`/tmp/bcorp_scrape_benefit_woo.py`)
2. Merge benefit corp products into main `bcorp_products.json`
3. Rebuild search.json and redeploy site
4. Scrape remaining platforms (Squarespace, BigCommerce, unknown) from both sources
5. Pull remaining data sources (Purpose Pledge, purpose trusts, steward-owned, 100% for Purpose)
6. Add ownership type labels to products (B Corp, benefit corp, steward-owned, etc.)

## Stats for Mark
| Source | Companies | With Website | E-commerce | Products Scraped |
|--------|-----------|-------------|------------|-----------------|
| B Corps | 593 candidates | 584 (98%) | 206 | 26,519 |
| Benefit Corps | 2,090 good standing | 1,735 (83%) | 419 (388 new) | 2,476 (Shopify only, WooCommerce pending) |
| **Total** | | | | **28,995** |
