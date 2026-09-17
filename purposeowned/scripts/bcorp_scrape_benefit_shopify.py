"""Scrape Shopify products from benefit corp stores (non-overlapping with B Corps)."""
import json
import time
import requests
import urllib3
from urllib.parse import urlparse

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

def scrape_shopify_products(base_url, max_pages=50):
    parsed = urlparse(base_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    all_products = []
    page = 1
    while page <= max_pages:
        try:
            url = f"{base}/products.json?limit=250&page={page}"
            resp = requests.get(url, timeout=15, headers=HEADERS, verify=False)
            if resp.status_code != 200:
                break
            if "json" not in resp.headers.get("content-type", ""):
                break
            data = resp.json()
            products = data.get("products", [])
            if not products:
                break
            for p in products:
                variants = p.get("variants", [])
                images = p.get("images", [])
                price = variants[0]["price"] if variants else None
                image = images[0]["src"] if images else None
                available = any(v.get("available", False) for v in variants) if variants else False
                tags = p.get("tags", []) if isinstance(p.get("tags"), list) \
                       else [t.strip() for t in p.get("tags", "").split(",") if t.strip()]
                all_products.append({
                    "title": p.get("title", ""),
                    "handle": p.get("handle", ""),
                    "price": price,
                    "available": available,
                    "image": image,
                    "url": f"{base}/products/{p.get('handle', '')}",
                    "product_type": p.get("product_type", ""),
                    "vendor": p.get("vendor", ""),
                    "tags": tags,
                })
            if len(products) < 250:
                break
            page += 1
            time.sleep(0.3)
        except:
            break
    return all_products

# Load benefit corp Shopify stores (new ones only)
with open('/Applications/worker-owned/purposeowned/benefit_corps_ecommerce.json') as f:
    benefit = json.load(f)

with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    bcorps = json.load(f)

bcorp_domains = set()
for c in bcorps:
    if c.get('website'):
        try: bcorp_domains.add(urlparse(c['website']).netloc.lower().replace('www.',''))
        except: pass

shopify_stores = [c for c in benefit
                  if c.get('ecommerce_platform') == 'Shopify'
                  and c.get('website')
                  and urlparse(c['website']).netloc.lower().replace('www.','') not in bcorp_domains]

# Dedupe by domain
seen = set()
deduped = []
for c in shopify_stores:
    domain = urlparse(c['website']).netloc.lower().replace('www.','')
    if domain not in seen:
        seen.add(domain)
        deduped.append(c)

log(f"Scraping {len(deduped)} benefit corp Shopify stores...\n")

all_products = []
store_results = {}

for c in sorted(deduped, key=lambda x: x['name']):
    name = c['name']
    url = c['website']
    products = scrape_shopify_products(url)

    # Validate: check if vendor matches company name somewhat (filter false domain matches)
    if products:
        vendors = set(p.get('vendor', '').lower() for p in products[:5])
        name_words = set(name.lower().split()[:3])
        # If vendor is clearly a different company, it's a false positive domain guess
        # (e.g. basin.com is not "Basin & Bend")
        # We keep it if ANY vendor word matches ANY name word, or if vendor is generic
        match = any(any(w in v for w in name_words) for v in vendors if v)
        if not match and len(products) > 50:
            # Large store with no name match — likely false positive
            log(f"  {name}: SKIP (false positive? vendor={list(vendors)[:3]})")
            store_results[name] = {"count": 0, "status": "false-positive", "url": url}
            continue

    for p in products:
        p["store_name"] = name
    all_products.extend(products)
    store_results[name] = {"count": len(products), "url": url}
    log(f"  {name}: {len(products)} products")
    time.sleep(0.5)

# Save
with open('/Applications/worker-owned/purposeowned/benefit_corps_products_shopify.json', 'w') as f:
    json.dump(all_products, f, indent=2)

success = len([r for r in store_results.values() if r['count'] > 0])
false_pos = len([r for r in store_results.values() if r.get('status') == 'false-positive'])
log(f"\n=== RESULTS ===")
log(f"Stores attempted: {len(store_results)}")
log(f"With products: {success}")
log(f"False positives filtered: {false_pos}")
log(f"Total products: {len(all_products)}")
log(f"\nSaved to purposeowned/benefit_corps_products_shopify.json")
