"""
Find Shopify B Corp stores via sitemap detection, then scrape products.
Strategy:
1. Hit /sitemap.xml on all 584 URLs
2. If sitemap has /products/ URLs or sitemap_products sub-sitemaps, it's likely Shopify
3. Scrape product URLs from sitemaps
4. Scrape individual product pages via .json suffix (Shopify product pages support this)
"""
import json
import re
import time
import requests
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
from html import unescape

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

def get_sitemap(base_url):
    """Fetch sitemap.xml and find product URLs or product sub-sitemaps."""
    try:
        resp = requests.get(f"{base_url}/sitemap.xml", timeout=10,
                          headers=HEADERS, verify=False)
        if resp.status_code != 200:
            return None, []

        text = resp.text

        # Check if this is a Shopify sitemap (has shopify-specific patterns)
        is_shopify = ("shopify" in text.lower() or
                     "sitemap_products" in text or
                     "/products/" in text)

        if not is_shopify:
            return None, []

        # Get direct product URLs
        product_urls = re.findall(r'<loc>([^<]*?/products/[^<]+)</loc>', text)
        product_urls = [unescape(u) for u in product_urls]

        # Get product sub-sitemaps
        sub_sitemaps = re.findall(r'<loc>([^<]*?sitemap[_/]products[^<]*)</loc>', text)
        sub_sitemaps = [unescape(u) for u in sub_sitemaps]

        # Fetch sub-sitemaps for more product URLs
        for sm_url in sub_sitemaps:
            try:
                r2 = requests.get(sm_url, timeout=10, headers=HEADERS, verify=False)
                if r2.status_code == 200:
                    more = re.findall(r'<loc>([^<]*?/products/[^<]+)</loc>', r2.text)
                    product_urls.extend([unescape(u) for u in more])
            except:
                continue
            time.sleep(0.2)

        # Dedupe
        product_urls = list(dict.fromkeys(product_urls))

        return "Shopify", product_urls

    except:
        return None, []

def scrape_shopify_product(url):
    """Scrape a single Shopify product page via .json suffix."""
    try:
        json_url = url.rstrip("/") + ".json"
        resp = requests.get(json_url, timeout=8, headers=HEADERS, verify=False)
        if resp.status_code == 200 and "json" in resp.headers.get("content-type", ""):
            data = resp.json()
            p = data.get("product", {})
            if p and p.get("title"):
                variants = p.get("variants", [])
                images = p.get("images", [])
                price = variants[0]["price"] if variants else None
                image = images[0]["src"] if images else None
                available = any(v.get("available", False) for v in variants) if variants else False

                return {
                    "title": p["title"],
                    "handle": p.get("handle", ""),
                    "price": price,
                    "available": available,
                    "image": image,
                    "url": url,
                    "product_type": p.get("product_type", ""),
                    "vendor": p.get("vendor", ""),
                    "tags": p.get("tags", []) if isinstance(p.get("tags"), list)
                           else [t.strip() for t in p.get("tags", "").split(",") if t.strip()],
                }
        # Try HTML fallback for price/title
        resp2 = requests.get(url, timeout=8, headers=HEADERS, verify=False)
        if resp2.status_code == 200:
            html = resp2.text
            title_m = re.search(r'<title>([^<]+)</title>', html)
            price_m = re.search(r'"\$?([\d,]+\.\d{2})"', html)
            img_m = re.search(r'"(https://cdn\.shopify\.com/s/files/[^"]+)"', html)
            if title_m:
                return {
                    "title": unescape(title_m.group(1).split("|")[0].split("–")[0].strip()),
                    "handle": url.split("/products/")[-1].rstrip("/"),
                    "price": price_m.group(1) if price_m else None,
                    "available": True,
                    "image": img_m.group(1) if img_m else None,
                    "url": url,
                    "product_type": "",
                    "vendor": "",
                    "tags": [],
                }
    except:
        pass
    return None

# Load companies
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    companies = json.load(f)

targets = [(i, c) for i, c in enumerate(companies) if c.get("website")]
log(f"Step 1: Checking {len(targets)} sites for Shopify sitemaps...")

# Step 1: Find Shopify stores via sitemap
shopify_stores = {}  # slug -> {name, url, product_urls}

with ThreadPoolExecutor(max_workers=20) as executor:
    def check_one(item):
        i, c = item
        parsed = urlparse(c["website"])
        base = f"{parsed.scheme}://{parsed.netloc}"
        platform, products = get_sitemap(base)
        return i, c, platform, products

    futures = {executor.submit(check_one, item): item for item in targets}
    done = 0
    for future in as_completed(futures):
        i, c, platform, products = future.result()
        if platform == "Shopify" and products:
            slug = c.get("slug", "")
            shopify_stores[slug] = {
                "name": c["name"],
                "website": c["website"],
                "industry": c.get("industry", ""),
                "product_urls": products,
            }
            companies[i]["ecommerce"] = True
            companies[i]["ecommerce_platform"] = "Shopify"
        done += 1
        if done % 100 == 0:
            log(f"  {done}/{len(targets)} — {len(shopify_stores)} Shopify stores found")

log(f"\nFound {len(shopify_stores)} Shopify stores with {sum(len(s['product_urls']) for s in shopify_stores.values())} total product URLs")

for slug, info in sorted(shopify_stores.items(), key=lambda x: -len(x[1]["product_urls"])):
    log(f"  {info['name']}: {len(info['product_urls'])} products — {info['website']}")

# Save store list
with open('/Applications/worker-owned/purposeowned/bcorp_shopify_stores.json', 'w') as f:
    json.dump({slug: {k: v for k, v in info.items() if k != 'product_urls'}
               for slug, info in shopify_stores.items()}, f, indent=2)

# Step 2: Scrape products from each store
log(f"\nStep 2: Scraping products from {len(shopify_stores)} stores...")

all_products = []
store_stats = {}

for slug, info in sorted(shopify_stores.items()):
    store_name = info["name"]
    product_urls = info["product_urls"]
    store_products = []
    errors = 0

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(scrape_shopify_product, url): url for url in product_urls}
        for future in as_completed(futures):
            result = future.result()
            if result:
                result["store_name"] = store_name
                result["store_slug"] = slug
                store_products.append(result)
            else:
                errors += 1

    all_products.extend(store_products)
    store_stats[slug] = {"name": store_name, "found": len(store_products),
                         "total": len(product_urls), "errors": errors}
    log(f"  {store_name}: {len(store_products)}/{len(product_urls)} products scraped")

    time.sleep(0.5)  # be nice between stores

# Save all products
with open('/Applications/worker-owned/purposeowned/bcorp_products.json', 'w') as f:
    json.dump(all_products, f, indent=2)

# Save updated companies
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json', 'w') as f:
    json.dump(companies, f, indent=2)

log(f"\n=== DONE ===")
log(f"Shopify stores: {len(shopify_stores)}")
log(f"Products scraped: {len(all_products)}")
log(f"Saved to purposeowned/bcorp_products.json")
