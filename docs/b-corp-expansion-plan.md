# B Corp Expansion Plan

**Date:** 2026-08-09
**Status:** Scoping / Not yet decided

## Context

Mark Hand (The Stakehold newsletter) floated a (1)(2)(3) framework for "do-gooder companies": share financial upside, share decision-making, commit to purpose beyond profit. He asked if there's a workerowned.info for purpose-committed companies (B Corps, benefit corps, steward ownership). This doc scopes what adding certified B Corporations would look like.

## The Universe

- ~9,500+ certified B Corps worldwide across 160 industries in 102 countries
- ~2,800 are US-based
- Most are B2B (consulting, marketing, finance) — the consumer-facing slice is what matters
- US-only consumer-facing with online stores: estimated **200-400 companies**
- Realistically scrapeable for the marketplace: **~115-180 new entries**

## Already Overlapping (Worker-Owned AND B Corp)

These 6 companies are already in the marketplace:

| Company | Type | Category |
|---------|------|----------|
| Cabot Creamery | Co-op + B Corp | Food & Pantry |
| King Arthur Baking | ESOP + B Corp | Food & Pantry |
| Equal Exchange | Co-op + B Corp | Coffee & Tea |
| Once Again Nut Butter | ESOP + B Corp | Food & Pantry |
| Taylor Guitars | ESOP + B Corp | Music |
| Dansko | ESOP + B Corp | Apparel |

## Consumer-Facing B Corps by Category

### Food & Pantry (biggest win — ~30-50 new brands)

- Ben & Jerry's, Stonyfield Organic, Amy's Kitchen, Jeni's Splendid Ice Creams
- Alter Eco (chocolate), Tony's Chocolonely (chocolate)
- GoodPop (popsicles), Miyoko's Creamery (vegan dairy), Once Upon a Farm (baby food)
- Greyston Bakery, Rhino Foods, NatureSweet (tomatoes)
- Guayakí (yerba mate), REBBL (beverages), OLIPOP (soda), Mother Kombucha
- Clover Sonoma (dairy), Valrhona (chocolate), Wyandot Snacks
- Thrive Market (online organic grocery)

### Apparel (massive — ~40-60 new brands)

- Patagonia, Allbirds, TOMS, Veja, Eileen Fisher
- Pangaia, Outerknown, Tentree, MATE the Label
- Nisolo (shoes), Encircled, Known Supply
- Bombas (socks), Cotopaxi (outdoor gear)
- Pact (organic basics), prAna (yoga/outdoor)
- Maggie Marilyn, Kathmandu, P.E Nation

### Personal Care (~15-25 new brands)

- The Body Shop, Weleda, Aesop, Aveda, Davines
- EO Products, Ethique (solid bars), Sunday Riley
- Alaffia (already in marketplace as co-op)
- Dr. Bronner's — **dropped B Corp certification Feb 2025** (still ethical, not certified)

### Coffee & Tea (~10-15 new brands)

- Numi Organic Tea, Stash Tea, Teatulia, Yogi Tea, Bigelow Tea
- Stumptown Coffee, Illy, Nespresso
- R. Torre & Company (MJB/Hills Bros coffee)
- Peace Coffee (already in marketplace)

### Home Goods & Services (~10-15 new brands)

- Klean Kanteen (bottles), Who Gives a Crap (paper products)
- Sabai (furniture), Savvy Rest (mattresses), Humanscale (office furniture)
- MiaDonna (lab-grown jewelry), Armadillo & Co (rugs)
- Uncommon Goods (marketplace), Leesa (mattresses)

### Beer & Brewing (~5-8 new brands)

- 4 Pines, Beau's All Natural, North Coast Brewing, Capital Brewing
- Stone & Wood, Young Henrys
- (BrewDog lost certification 2022; not eligible)

### Tech & Software (~3-5 consumer-facing)

- PELA Case (compostable phone cases), Nimble (eco chargers)
- Agood (phone cases/notebooks)
- Coursera (education platform)
- Loomio (already in marketplace as co-op)

### Media & Publishing (thin — mostly B2B)

- Lulu (self-publishing platform)
- Guardian Media Group
- Not many consumer brands here

### Cleaning & Household (~5-10 new brands)

- Seventh Generation, Meliora, Grove Collaborative
- The Honest Company

### Games

- Basically nothing B Corp certified in this space

## Growth Impact

| Category | New B Corp Entries | Current Entries | Growth |
|----------|-------------------|-----------------|--------|
| Food & Pantry | 30-50 | 27 | 2-3x |
| Apparel | 40-60 | 19 | 3-4x |
| Personal Care | 15-25 | 7 | 3-4x |
| Coffee & Tea | 10-15 | 15 | 1.5-2x |
| Home Goods | 10-15 | 15 | 1.5-2x |
| Beer & Brewing | 5-8 | 12 | 1.4-1.7x |
| Tech & Software | 3-5 | 9 | 1.3x |
| Media & Publishing | 2-3 | 45 | minimal |
| Games | 0 | 7 | no change |
| **Total** | **~115-180** | **170** | **~2x** |

Product count: could go from **30k to 80-100k+** products (Patagonia alone has thousands of SKUs).

## Data Sources

### B Corp Directory
- **Apify scraper**: `apify.com/njoylab/b-corporation-data-scraper` — can pull full directory with industry, website, demographic ownership flags, B Impact scores. Supports pagination (250/page).
- **Kaggle dataset**: `kaggle.com/datasets/thedevastator/b-corporation-impact-data` — 5,000+ entries, CC BY-SA 4.0, free CSV download. May be slightly outdated but solid starting point.
- **GitHub API**: `github.com/PRANAVBHATIA1999/B-Corps-API` — Flask/Heroku, basic fields (name, industry, location). Likely stale.
- **bcorporation.net direct access**: Returns 403 for programmatic access. Blocks AI crawlers.

### Individual Store Scraping
- Most big consumer B Corps (Patagonia, Allbirds, Bombas, etc.) run **Shopify** — existing scraper handles these
- Some use BigCommerce, WooCommerce, or custom platforms
- Pipeline: Pull B Corp directory → filter US/Canada + consumer-facing → extract website URLs → detect platform → run through existing scraper

## Categories That Would Need to Be Added

None — B Corps map cleanly onto existing 11 marketplace categories. Potential new subcategories:
- food-pantry → ice-cream, beverages, snacks, baby-food
- apparel → activewear, outdoor-gear, socks
- personal-care → fragrance, haircare
- New top-level? → cleaning-products (Seventh Generation, Meliora, etc.)

## Strategic Considerations

### The Mission Dilution Problem

B Corps are NOT worker-owned. They score well on social/environmental impact, but ownership structure varies wildly:
- Some are **public companies** (Danone, Nespresso parent Nestlé SA)
- Some are **VC-backed startups** (Allbirds, OLIPOP)
- Some are **family-owned** (Dr. Bronner's pre-decertification)
- A few are **actually worker-owned** (already in marketplace)

### UX Requirements If Proceeding

1. **New ownership badge color** (e.g., orange = "Certified B Corp") alongside existing blue/green/purple
2. **Filter toggle** — users should be able to show/hide B Corps vs worker-owned
3. **Clear labeling** — visitors must understand the difference
4. **Separate or integrated?** Options:
   - Same marketplace with badge + filter (simplest)
   - Separate tab/section ("Worker-Owned" vs "B Corp Certified")
   - Separate subdomain (bcorp.workerowned.info — most separation, most work)

### B Corp Certification Instability

- Dr. Bronner's (highest score globally) dropped certification Feb 2025
- BrewDog had certification rescinded 2022
- Havas agencies lost status July 2024 over Shell work
- Nespresso certification contested by 30 other B Corps
- Would need periodic re-verification against the directory

### Alternative: B Corp Badge on Existing Entries

Instead of adding all B Corps, just add a "B Corp Certified" badge to the 6+ companies already in the marketplace that hold dual status. Low effort, no mission dilution.

## Sources

- [Wikipedia: B Corporation (certification)](https://en.wikipedia.org/wiki/B_Corporation_(certification))
- [Wikipedia: Certified B Corps in Food & Beverage](https://en.wikipedia.org/wiki/Category:Certified_B_Corporations_in_the_Food_&_Beverage_Industry)
- [The Honest Consumer: B Corp List](https://www.thehonestconsumer.com/blog/certified-b-corporation-list)
- [Green Is The New Black: 25 B Corp Brands](https://greenisthenewblack.com/25-b-corp-brands/)
- [RUSSH: 26 B Corp Brands](https://www.russh.com/b-corp-brands/)
- [ReqoData: B Corp Food & Beverage Brands](https://reqodata.com/en/certified-b-corp-food-and-beverage-brands)
- [Apify: B-Corporation Data Scraper](https://apify.com/njoylab/b-corporation-data-scraper)
- [GitHub: B-Corps-API](https://github.com/PRANAVBHATIA1999/B-Corps-API)
- [Kaggle: B Corp Impact Data](https://www.kaggle.com/datasets/thedevastator/b-corporation-impact-data)
