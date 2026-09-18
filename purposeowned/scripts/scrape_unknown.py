"""Detect platform and scrape products from unknown-platform stores."""
import json
import re
import time
import requests
import urllib3
from html import unescape
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# Load unknown stores
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    bcorps = json.load(f)
with open('/Applications/worker-owned/purposeowned/benefit_corps_ecommerce.json') as f:
    benefit = json.load(f)
with open('/Applications/worker-owned/purposeowned/bcorp_products.json') as f:
    existing = json.load(f)

# Already scraped domains
scraped_domains = set()
for p in existing:
    try:
        scraped_domains.add(urlparse(p.get('url', '')).netloc.lower().replace('www.', ''))
    except:
        pass

# Also load squarespace/bigcommerce/magento products
for fname in ['products_squarespace.json', 'products_bigcommerce.json', 'products_magento.json']:
    try:
        with open(f'/Applications/worker-owned/purposeowned/{fname}') as f:
            for p in json.load(f):
                try:
                    scraped_domains.add(urlparse(p.get('url', '')).netloc.lower().replace('www.', ''))
                except:
                    pass
    except:
        pass

# Collect unknown stores not yet scraped
unknowns_bcorp = [c for c in bcorps if not c.get('ecommerce_platform') or c['ecommerce_platform'] in ('Unknown', '')]
unknowns_ben = [c for c in benefit if not c.get('ecommerce_platform') or c['ecommerce_platform'] in ('Unknown', 'None', '')]

seen = set()
stores = []
for c in unknowns_bcorp + unknowns_ben:
    w = c.get('website', '')
    if not w:
        continue
    domain = urlparse(w).netloc.lower().replace('www.', '')
    if domain in scraped_domains or domain in seen:
        continue
    seen.add(domain)
    stores.append(c)

log(f"Attempting {len(stores)} unknown-platform stores...\n")


def try_shopify(base):
    """Try Shopify /products.json endpoint."""
    products = []
    page = 1
    while page <= 20:
        try:
            url = f"{base}/products.json?limit=250&page={page}"
            r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            data = r.json()
            items = data.get("products", [])
            if not items:
                break
            for p in items:
                variants = p.get("variants", [{}])
                price = variants[0].get("price") if variants else None
                available = any(v.get("available", False) for v in variants) if variants else True
                images = p.get("images", [])
                products.append({
                    "title": p.get("title", ""),
                    "handle": p.get("handle", ""),
                    "price": price,
                    "available": available,
                    "image": images[0].get("src") if images else None,
                    "url": f"{base}/products/{p.get('handle', '')}",
                    "product_type": p.get("product_type", ""),
                    "vendor": p.get("vendor", ""),
                    "tags": p.get("tags", "").split(", ") if isinstance(p.get("tags"), str) else p.get("tags", []),
                })
            if len(items) < 250:
                break
            page += 1
            time.sleep(0.3)
        except:
            break
    return products


def try_woocommerce(base):
    """Try WooCommerce Store API."""
    products = []
    page = 1
    while page <= 20:
        try:
            url = f"{base}/wp-json/wc/store/products?per_page=100&page={page}"
            r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            data = r.json()
            if not data:
                break
            for p in data:
                prices = p.get("prices", {})
                raw_price = prices.get("price", "0")
                minor_unit = prices.get("currency_minor_unit", 2)
                try:
                    price = str(float(raw_price) / (10 ** minor_unit))
                except:
                    price = None
                images = p.get("images", [])
                products.append({
                    "title": unescape(p.get("name", "")),
                    "handle": p.get("slug", ""),
                    "price": price,
                    "available": p.get("is_purchasable", True) and p.get("is_in_stock", True),
                    "image": images[0]["src"] if images else None,
                    "url": p.get("permalink", ""),
                    "product_type": "",
                    "vendor": "",
                    "tags": [],
                })
            if len(data) < 100:
                break
            page += 1
            time.sleep(0.3)
        except:
            break
    return products


def try_bigcommerce(base):
    """Try BigCommerce xmlsitemap + LD+JSON."""
    urls = []
    page = 1
    while page <= 5:
        try:
            r = requests.get(f'{base}/xmlsitemap.php?type=products&page={page}', timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            locs = re.findall(r'<loc>([^<]+)</loc>', r.text)
            if not locs:
                break
            urls.extend(locs)
            if len(locs) < 1000:
                break
            page += 1
        except:
            break
    if not urls:
        return []

    products = []
    for url in urls[:200]:
        try:
            r = requests.get(url, timeout=8, headers=HEADERS, verify=False)
            if r.status_code != 200:
                continue
            for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', r.text, re.DOTALL):
                try:
                    ld = json.loads(m.group(1))
                    items = [ld] if isinstance(ld, dict) else ld if isinstance(ld, list) else []
                    if isinstance(ld, dict) and ld.get("@graph"):
                        items = ld["@graph"]
                    for item in items:
                        if item.get("@type") != "Product":
                            continue
                        offers = item.get("offers", {})
                        if isinstance(offers, list):
                            offers = offers[0] if offers else {}
                        price = offers.get("price") or offers.get("lowPrice")
                        image = item.get("image")
                        if isinstance(image, list):
                            image = image[0] if image else None
                        if isinstance(image, dict):
                            image = image.get("url")
                        products.append({
                            "title": unescape(item.get("name", "")),
                            "handle": url.rstrip("/").split("/")[-1],
                            "price": str(price) if price else None,
                            "available": "InStock" in str(offers.get("availability", "InStock")),
                            "image": image,
                            "url": url,
                            "product_type": item.get("category", "") or "",
                            "vendor": "",
                            "tags": [],
                        })
                except:
                    continue
            time.sleep(0.15)
        except:
            continue
    return products


all_products = []
platform_counts = {"shopify": 0, "woocommerce": 0, "bigcommerce": 0, "none": 0}

for i, c in enumerate(sorted(stores, key=lambda x: x['name'])):
    name = c['name']
    base = c['website'].rstrip('/')

    # Try Shopify first (fastest check)
    products = try_shopify(base)
    if products:
        platform = "shopify"
    else:
        # Try WooCommerce
        products = try_woocommerce(base)
        if products:
            platform = "woocommerce"
        else:
            # Try BigCommerce
            products = try_bigcommerce(base)
            if products:
                platform = "bigcommerce"
            else:
                platform = "none"

    for p in products:
        p["store_name"] = name

    all_products.extend(products)
    platform_counts[platform] += 1

    if products:
        log(f"  [{i+1}/{len(stores)}] {name}: {len(products)} products ({platform})")
    elif (i + 1) % 50 == 0:
        log(f"  [{i+1}/{len(stores)}] progress checkpoint...")

    time.sleep(0.3)

with open('/Applications/worker-owned/purposeowned/products_unknown.json', 'w') as f:
    json.dump(all_products, f, indent=2)

stores_with = len(set(p["store_name"] for p in all_products))
log(f"\n=== RESULTS ===")
log(f"Stores attempted: {len(stores)}")
log(f"Platforms found: {platform_counts}")
log(f"Stores with products: {stores_with}")
log(f"Total products: {len(all_products)}")
log(f"Saved to purposeowned/products_unknown.json")
