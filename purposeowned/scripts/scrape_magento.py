"""Scrape Magento stores for products via sitemap + LD-JSON."""
import json
import re
import time
import requests
import urllib3
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

STORES = [
    {"name": "Carnegie Fabrics LLC", "website": "https://carnegiefabrics.com/"},
    {"name": "GloryBee", "website": "https://www.glorybee.com"},
    {"name": "R. Torre & Company (Torani)", "website": "https://www.torani.com"},
    {"name": "Softstar Shoes", "website": "https://www.softstarshoes.com/"},
]

def find_product_urls_sitemap(base_url):
    """Find product URLs from sitemap."""
    urls = []
    try:
        r = requests.get(f"{base_url}/sitemap.xml", timeout=10, headers=HEADERS, verify=False)
        if r.status_code != 200:
            return []
        subs = re.findall(r'<loc>([^<]+)</loc>', r.text)
        for sm_url in subs:
            if not sm_url.endswith('.xml'):
                continue
            try:
                r2 = requests.get(sm_url, timeout=10, headers=HEADERS, verify=False)
                if r2.status_code == 200:
                    for u in re.findall(r'<loc>([^<]+)</loc>', r2.text):
                        # Filter for likely product pages
                        if any(x in u for x in ['/product', '.html', '/catalog/']):
                            urls.append(u)
            except:
                continue
            time.sleep(0.2)
    except:
        pass
    return list(dict.fromkeys(urls))

def scrape_product_page(url):
    """Extract product data from a single page using LD+JSON."""
    try:
        r = requests.get(url, timeout=8, headers=HEADERS, verify=False)
        if r.status_code != 200:
            return None
        html = r.text
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
            try:
                ld = json.loads(m.group(1))
                items = [ld] if isinstance(ld, dict) else []
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
                    if isinstance(image, list): image = image[0] if image else None
                    if isinstance(image, dict): image = image.get("url")
                    avail = offers.get("availability", "")
                    return {
                        "title": unescape(item.get("name", "")),
                        "handle": url.rstrip("/").split("/")[-1].replace(".html", ""),
                        "price": str(price) if price else None,
                        "available": "InStock" in avail if avail else True,
                        "image": image,
                        "url": url,
                        "product_type": item.get("category", "") or "",
                        "vendor": item.get("brand", {}).get("name", "") if isinstance(item.get("brand"), dict) else "",
                        "tags": [],
                    }
            except:
                continue
    except:
        pass
    return None

log(f"Scraping {len(STORES)} Magento stores...\n")

all_products = []
for store in STORES:
    name = store["name"]
    base = store["website"].rstrip("/")

    urls = find_product_urls_sitemap(base)
    log(f"  {name}: found {len(urls)} URLs in sitemap")

    products = []
    if urls:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(scrape_product_page, u): u for u in urls[:500]}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    result["store_name"] = name
                    products.append(result)

    all_products.extend(products)
    log(f"  {name}: {len(products)} products scraped")
    time.sleep(0.5)

with open("/Applications/worker-owned/purposeowned/products_magento.json", "w") as f:
    json.dump(all_products, f, indent=2)

success = len(set(p["store_name"] for p in all_products))
log(f"\n=== RESULTS ===")
log(f"Stores attempted: {len(STORES)}")
log(f"With products: {success}")
log(f"Total products: {len(all_products)}")
log(f"Saved to purposeowned/products_magento.json")
