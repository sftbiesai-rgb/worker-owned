# Purpose Owned — Scrape Status (2026-09-17)

## Site
- **Live at**: https://purposeowned.vercel.app
- **Location**: `purposeowned/site/` (Vite + React + Tailwind)
- **Currently showing**: 63,545 products from 218 stores

## Data Sources

### 1. B Corps (bcorporation.net) — DONE
- **Source**: Typesense API at bcorporation.net
- **Raw data**: `bcorp_us_companies.json` (3,407 US B Corps)
- **Filtered**: `bcorp_us_hq_ecommerce.json` (593 consumer/retail candidates, 584 with websites)
- **E-commerce detected**: 206 stores
  - Shopify: 89 — DONE (25,051 products)
  - WooCommerce: 26 — DONE (1,468 products)
  - Squarespace: 14 — DONE (included in squarespace scrape)
  - BigCommerce: 7 — DONE (included in bigcommerce scrape)
  - Magento: 4 — DONE (31 products from Softstar; other 3 had no scrapable product data)
  - Unknown: 66 — DONE (many turned out to be Shopify, scraped in unknown pass)

### 2. Benefit Corporations (domoregood.com) — DONE
- **Source**: Google Sheets CSV at domoregood.com/benefit-corporation-directory
- **Raw data**: `benefit_corps.json` (2,090 in good standing out of 10,311 total)
- **Websites found**: 1,735 (83%) via domain guessing
- **E-commerce detected**: `benefit_corps_ecommerce.json` (419 stores, 388 new)
  - Shopify: 50 — DONE (2,476 products)
  - WooCommerce: 108 — DONE (3,454 products)
  - Squarespace: 14 — DONE (included in squarespace scrape)
  - BigCommerce: 3 — DONE (included in bigcommerce scrape)
  - Unknown: 213 — DONE (scraped in unknown pass)

### Platform scrape results
| Platform | Stores attempted | With products | Products |
|----------|-----------------|---------------|----------|
| Shopify (B Corp) | 82 | 80 | 25,051 |
| WooCommerce (B Corp) | 26 | 13 | 1,468 |
| Shopify (Benefit Corp) | 50 | 22 | 2,476 |
| WooCommerce (Benefit Corp) | 108 | 18 | 3,454 |
| Squarespace (both) | 28 | 11 | 189 |
| BigCommerce (both) | 10 | 4 | 3,110 |
| Magento (B Corp) | 4 | 1 | 31 |
| Unknown (both) | 613 | 71 (all Shopify) | 27,857 |
| **Total** | | **218** (after dedup) | **63,545** |

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

## Product files
- `bcorp_products.json` — merged master file (63,545 products)
- `products_squarespace.json` — 189 products from 11 stores
- `products_bigcommerce.json` — 3,110 products from 4 stores
- `products_magento.json` — 31 products from 1 store
- `products_unknown.json` — 27,857 products from 71 stores

## Scripts (in `purposeowned/scripts/`)
- `bcorp_shopify_scrape.py` — Sitemap-based Shopify scraper (B Corps)
- `bcorp_scrape_blocked.py` — /products.json pagination scraper for blocked stores
- `bcorp_scrape_woocommerce.py` — WooCommerce scraper (B Corps)
- `bcorp_benefit_corps.py` — Benefit corp directory pull + website finding + ecommerce detection
- `bcorp_scrape_benefit_shopify.py` — Benefit corp Shopify scraper
- `bcorp_scrape_benefit_woo.py` — Benefit corp WooCommerce scraper
- `scrape_squarespace.py` — Squarespace scraper (both sources)
- `scrape_bigcommerce.py` — BigCommerce scraper (both sources)
- `scrape_magento.py` — Magento scraper
- `scrape_unknown.py` — Unknown platform auto-detect + scrape
- `bcorp_find_shopify.py` — Early Shopify finder via /products.json
- `bcorp_triage_ecommerce.py` — E-commerce triage script
- `bcorp_last40.py` — URL fixer for last 40 missing websites

## UI (2026-09-17)
- Divergent mobile/desktop: mobile 2-col grid + filter drawer, desktop sidebar facets + grid/list toggle
- Filters: ownership type, price range, industry, store, in-stock toggle, refine text
- Dynamic facet counts (update based on current filter state)
- Round-robin store diversity in search results
- Autocomplete suggestions on desktop
- $0.00 prices treated as no price (3,524 products affected)
- Products without images hidden from search results
- Image aspect ratio 4:3 for denser grid

## Next Steps
1. ~~Scrape remaining platforms (Squarespace, BigCommerce, Magento, unknown)~~ ✓
2. ~~Pull remaining data sources (Purpose Pledge, steward-owned, 100% for Purpose)~~ ✓
3. ~~Add ownership type labels to products (B Corp, benefit corp, steward-owned, etc.)~~ ✓
4. ~~Divergent mobile/desktop UI with filters~~ ✓
5. Tags stripped from search.json to keep file size under Vercel limits (was 25MB → 15MB)
6. Purpose Trusts directory still needs data (Notion page requires JS; ask Mark Hand)
7. See COVERAGE.md for outstanding stores that couldn't be scraped
8. 57 stores (6,648 products) have no industry category — need manual mapping
9. Custom scrapers needed for: Patagonia, King Arthur, Cariloha, Lake Champlain, Torani

## Stats for Mark
| Source | Companies | With Website | E-commerce | Products Scraped |
|--------|-----------|-------------|------------|-----------------|
| B Corps | 593 candidates | 584 (98%) | 206 | ~28,000 |
| Benefit Corps | 2,090 good standing | 1,735 (83%) | 419 (388 new) | ~35,500 |
| **Total** | | | **218 stores** | **63,545** |
