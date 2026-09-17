"""
Scrape products from blocked/partial Shopify B Corp stores using /products.json pagination.
The original scraper used {product_url}.json which many stores block.
But /products.json?limit=250&page=N works on nearly all Shopify stores.
"""
import json
import time
import requests
import urllib3
from urllib.parse import urlparse

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

def scrape_store_products(base_url, max_pages=50):
    """Scrape all products from a Shopify store via /products.json pagination."""
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
            ct = resp.headers.get("content-type", "")
            if "json" not in ct:
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
                break  # last page
            page += 1
            time.sleep(0.3)

        except Exception as e:
            log(f"    Error page {page}: {e}")
            break

    return all_products


# Load the sitemap scraper output to know which stores need re-scraping
with open('/Applications/worker-owned/purposeowned/bcorp_shopify_stores.json') as f:
    store_list = json.load(f)

# Parse the scraper output to identify blocked and partial stores
import re
blocked_stores = []
partial_stores = []

# Read the scraper output
try:
    with open('/private/tmp/claude-501/-Applications-worker-owned/2a2b76a3-9e69-408c-8093-bc89ec1b743d/tasks/bxijiwdha.output') as f:
        for line in f:
            m = re.search(r'^\s+(.+?):\s+(\d+)/(\d+)\s+products scraped', line)
            if m:
                name, got, total = m.group(1), int(m.group(2)), int(m.group(3))
                if got == 0:
                    blocked_stores.append(name)
                elif got < total * 0.9:  # less than 90% scraped
                    partial_stores.append((name, got, total))
except:
    pass

log(f"Blocked stores to rescrape: {len(blocked_stores)}")
log(f"Partial stores to rescrape: {len(partial_stores)}")

# Build name->store mapping from the ecommerce JSON
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    companies = json.load(f)

name_to_url = {}
for c in companies:
    if c.get("website") and c.get("ecommerce_platform") == "Shopify":
        name_to_url[c["name"]] = c["website"]

# Scrape blocked stores
all_new_products = []
store_results = {}

targets = []
for name in blocked_stores:
    url = name_to_url.get(name)
    if url:
        targets.append((name, url, "blocked"))

for name, got, total in partial_stores:
    url = name_to_url.get(name)
    if url:
        targets.append((name, url, "partial"))

log(f"\nScraping {len(targets)} stores via /products.json pagination...\n")

for name, url, status in sorted(targets, key=lambda x: x[0]):
    products = scrape_store_products(url)
    all_new_products.extend([{**p, "store_name": name} for p in products])
    store_results[name] = {"count": len(products), "status": status, "url": url}
    log(f"  {name}: {len(products)} products ({status})")
    time.sleep(0.5)

# Save results
with open('/Applications/worker-owned/purposeowned/bcorp_products_blocked.json', 'w') as f:
    json.dump(all_new_products, f, indent=2)

log(f"\n=== RESULTS ===")
log(f"Stores scraped: {len(store_results)}")
log(f"Products found: {len(all_new_products)}")

success = len([r for r in store_results.values() if r["count"] > 0])
still_blocked = len([r for r in store_results.values() if r["count"] == 0])
log(f"Stores with products: {success}")
log(f"Still blocked: {still_blocked}")

if still_blocked:
    log(f"\nStill blocked stores:")
    for name, r in sorted(store_results.items()):
        if r["count"] == 0:
            log(f"  {name} — {r['url']}")

log(f"\nSaved to purposeowned/bcorp_products_blocked.json")
