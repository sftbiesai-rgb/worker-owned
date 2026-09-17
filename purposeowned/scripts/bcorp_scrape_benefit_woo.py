"""Scrape WooCommerce products from benefit corp stores."""
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

def scrape_via_store_api(base_url, max_pages=20):
    products = []
    page = 1
    while page <= max_pages:
        try:
            url = f"{base_url}/wp-json/wc/store/products?per_page=100&page={page}"
            r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200: break
            data = r.json()
            if not data: break
            for p in data:
                prices = p.get("prices", {})
                raw_price = prices.get("price", "0")
                minor_unit = prices.get("currency_minor_unit", 2)
                try: price = str(float(raw_price) / (10 ** minor_unit))
                except: price = None
                images = p.get("images", [])
                products.append({
                    "title": unescape(p.get("name", "")),
                    "handle": p.get("slug", ""),
                    "price": price,
                    "available": p.get("is_purchasable", True) and p.get("is_in_stock", True),
                    "image": images[0]["src"] if images else None,
                    "url": p.get("permalink", ""),
                    "product_type": "", "vendor": "", "tags": [],
                })
            if len(data) < 100: break
            page += 1
            time.sleep(0.3)
        except: break
    return products

def find_product_urls(base_url):
    product_urls = []
    try:
        r = requests.get(f"{base_url}/sitemap.xml", timeout=8, headers=HEADERS, verify=False)
        if r.status_code != 200: return []
        subs = re.findall(r'<loc>([^<]+)</loc>', r.text)
        for sm_url in subs:
            try:
                r2 = requests.get(sm_url, timeout=8, headers=HEADERS, verify=False)
                if r2.status_code == 200:
                    for u in re.findall(r'<loc>([^<]+)</loc>', r2.text):
                        if '/product/' in u or '/shop/' in u:
                            product_urls.append(unescape(u))
            except: continue
            time.sleep(0.2)
    except: pass
    return list(dict.fromkeys(product_urls))

def scrape_product_html(url):
    try:
        r = requests.get(url, timeout=8, headers=HEADERS, verify=False)
        if r.status_code != 200: return None
        html = r.text
        title = price = image = None
        available = True
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
            try:
                ld = json.loads(m.group(1))
                items = [ld] if isinstance(ld, dict) else []
                if isinstance(ld, dict) and ld.get("@graph"):
                    items = ld["@graph"]
                for item in items:
                    if item.get("@type") == "Product":
                        title = item.get("name")
                        img = item.get("image")
                        image = img[0] if isinstance(img, list) and img else img
                        offers = item.get("offers", {})
                        if isinstance(offers, list): offers = offers[0] if offers else {}
                        price = offers.get("price")
                        avail = offers.get("availability", "")
                        available = "InStock" in avail if avail else True
                        break
            except: continue
        if not title:
            m = re.search(r'<meta property="og:title" content="([^"]+)"', html)
            if m: title = unescape(m.group(1))
        if not price:
            m = re.search(r'<meta property="product:price:amount" content="([^"]+)"', html)
            if m: price = m.group(1)
        if not image:
            m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
            if m: image = m.group(1)
        if title:
            return {"title": title, "handle": url.rstrip("/").split("/")[-1],
                    "price": str(price) if price else None, "available": available,
                    "image": image, "url": url, "product_type": "", "vendor": "", "tags": []}
    except: pass
    return None

# Load data
with open('/Applications/worker-owned/purposeowned/benefit_corps_ecommerce.json') as f:
    benefit = json.load(f)
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    bcorps = json.load(f)

bcorp_domains = set()
for c in bcorps:
    if c.get('website'):
        try: bcorp_domains.add(urlparse(c['website']).netloc.lower().replace('www.',''))
        except: pass

woo_stores = [c for c in benefit
              if c.get('ecommerce_platform') == 'WooCommerce'
              and c.get('website')
              and urlparse(c['website']).netloc.lower().replace('www.','') not in bcorp_domains]

# Dedupe by domain
seen = set()
deduped = []
for c in woo_stores:
    domain = urlparse(c['website']).netloc.lower().replace('www.','')
    if domain not in seen:
        seen.add(domain)
        deduped.append(c)

log(f"Scraping {len(deduped)} benefit corp WooCommerce stores...\n")

all_products = []
store_results = {}

for c in sorted(deduped, key=lambda x: x['name']):
    name = c['name']
    base = c['website'].rstrip('/')
    products = scrape_via_store_api(base)
    method = "store-api"

    if not products:
        urls = find_product_urls(base)
        if urls:
            method = "sitemap+html"
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = {executor.submit(scrape_product_html, u): u for u in urls}
                for future in as_completed(futures):
                    result = future.result()
                    if result: products.append(result)

    if not products:
        method = "shop-page"
        try:
            for path in ["/shop", "/shop/", "/products", "/store"]:
                r = requests.get(f"{base}{path}", timeout=8, headers=HEADERS, verify=False)
                if r.status_code == 200 and "/product/" in r.text:
                    urls = list(dict.fromkeys(re.findall(r'href="([^"]*?/product/[^"]+)"', r.text)))
                    if urls:
                        with ThreadPoolExecutor(max_workers=5) as executor:
                            futures = {executor.submit(scrape_product_html, u): u for u in urls}
                            for future in as_completed(futures):
                                result = future.result()
                                if result: products.append(result)
                        break
        except: pass

    for p in products:
        p["store_name"] = name
    all_products.extend(products)
    store_results[name] = {"count": len(products), "method": method}
    log(f"  {name}: {len(products)} products (via {method})")
    time.sleep(0.5)

with open('/Applications/worker-owned/purposeowned/benefit_corps_products_woo.json', 'w') as f:
    json.dump(all_products, f, indent=2)

success = len([r for r in store_results.values() if r['count'] > 0])
log(f"\n=== RESULTS ===")
log(f"Stores attempted: {len(store_results)}")
log(f"With products: {success}")
log(f"Total products: {len(all_products)}")
log(f"\nSaved to purposeowned/benefit_corps_products_woo.json")
