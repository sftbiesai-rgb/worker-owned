# Scrape Status & Resume Guide

Last updated: 2026-08-27

## If processes stopped or machine rebooted

### 1. Restore checkpoints from /tmp
```bash
bash scripts/restore-checkpoints.sh
```
This copies saved checkpoints from `checkpoints/` back to `/tmp/`.

### 2. Resume or re-merge each scraper

**Microcosm Publishing** (~43K URLs, ~25K products so far, 62% done)
```bash
# Resume where it left off:
node scripts/scrape-microcosm.mjs --resume

# Or if done, just merge checkpoint into products.json:
node scripts/scrape-microcosm.mjs --merge-only
```

**Bull Moose** (done — 28,487 products)
```bash
node scripts/scrape-bullmoose.mjs --merge-only
```

**Landry's Bicycles** (partial — 5,475 verified products, Nov 15 2026; full re-scrape at PARALLEL 5 another day, stop if 403s)
```bash
node scripts/scrape-landrys.mjs --merge-only
```

**Scheels** (310 products with prices, Cloudflare blocks most requests)
```bash
# Merge the 310 enriched products manually — see below
# The scraper's --merge-only uses the category checkpoint (no prices)
# so use this Python one-liner instead:
python3 -c "
import json
with open('/tmp/scheels-enrich-checkpoint.json') as f:
    scheels = json.load(f)['products']
with open('src/data/marketplace.json') as f:
    entry = next(e for e in json.load(f) if e['name'] == 'Scheels All Sports')
formatted = [{'id': f'166-scheels-{p[\"id\"]}', 'title': p['title'], 'price': p['price'], 'available': True, 'image': p.get('image',''), 'url': p['url'].split('?')[0], 'store_name': entry['name'], 'store_url': entry['url'], 'ownership_type': entry['ownership_type'], 'site_section': 'Sporting Goods', 'tags': [t for t in [p.get('brand','')] if t]} for p in scheels]
with open('public/data/products.json') as f:
    existing = json.load(f)
others = [p for p in existing if p.get('store_name') != 'Scheels All Sports']
with open('public/data/products.json', 'w') as f:
    json.dump(others + formatted, f, indent=2)
print(f'Merged {len(formatted)} Scheels + {len(others)} others = {len(others)+len(formatted)} total')
"
```

**Southern Exposure** (API flaky, 881 products available when it's up)
```bash
# Just re-run the general scraper — it handles Southern Exposure
node scripts/scrape-products.mjs
```

### 3. Re-merge order matters!
The general scraper (`scrape-products.mjs`) overwrites products.json completely.
Custom scrapers merge additively. So always run in this order:

```bash
# 1. General scraper first (overwrites)
node scripts/scrape-products.mjs

# 2. Then merge custom scrapers on top
node scripts/scrape-bullmoose.mjs --merge-only
node scripts/scrape-landrys.mjs --merge-only
node scripts/scrape-microcosm.mjs --merge-only
node scripts/scrape-steam-studios.mjs   # worker-owned game studios, live from Steam (rerun after launches)
# Scheels: use the python snippet above

# 3. Split into category files + search index
node scripts/split-products.mjs

# 4. Push
gh auth switch --user sftbiesai-rgb
git add public/data/
git commit -m "Refresh product data"
git push
```

## Checkpoint files
| File | Scraper | Location |
|------|---------|----------|
| `bm-scrape-raw.json` | Bull Moose | `/tmp/` + `checkpoints/` |
| `landrys-scrape-checkpoint.json` | Landry's | `/tmp/` + `checkpoints/` |
| `microcosm-scrape-checkpoint.json` | Microcosm | `/tmp/` + `checkpoints/` |
| `scheels-categories-checkpoint.json` | Scheels (no prices) | `/tmp/` + `checkpoints/` |
| `scheels-enrich-checkpoint.json` | Scheels (with prices) | `/tmp/` + `checkpoints/` |

## Nov 15 2026 refresh
- Thrifty White 4,874 and King Arthur 797 (BigCommerce out-of-stock items now skipped; IDs are URL-slug based).
- Zia 6,350 (keeps /pid vs /p id spaces). PM Press uses scrape-pmpress.mjs (UnifyCart). 1620 Workwear removed.
- `scrape-products.mjs --only=<ids> --stores-out=<file>` writes those stores to a separate file and leaves products.json alone.
- Catalog total ~213,151.
