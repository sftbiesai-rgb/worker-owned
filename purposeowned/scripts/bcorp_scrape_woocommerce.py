"""Scrape products from WooCommerce B Corp stores.
Methods:
1. /wp-json/wc/store/products (Store API - paginated)
2. product-sitemap.xml -> individual product page HTML scraping
3. /shop page HTML scraping as fallback
"""
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

def scrape_via_store_api(base_url, max_pages=20):
    """Use WooCommerce Store API to get products."""
    products = []
    page = 1
    while page <= max_pages:
        try:
            url = f"{base_url}/wp-json/wc/store/products?per_page=100&page={page}"
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
                image = images[0]["src"] if images else None
                products.append({
                    "title": unescape(p.get("name", "")),
                    "handle": p.get("slug", ""),
                    "price": price,
                    "available": p.get("is_purchasable", True) and p.get("is_in_stock", True),
                    "image": image,
                    "url": p.get("permalink", ""),
                    "product_type": p.get("type", ""),
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

def find_product_urls_from_sitemap(base_url):
    """Find product URLs from WooCommerce sitemaps."""
    product_urls = []
    try:
        r = requests.get(f"{base_url}/sitemap.xml", timeout=8, headers=HEADERS, verify=False)
        if r.status_code != 200:
            return []
        # Check for product sub-sitemap
        subs = re.findall(r'<loc>([^<]*product[^<]*sitemap[^<]*)</loc>', r.text)
        if not subs:
            subs = re.findall(r'<loc>([^<]*sitemap[^<]*product[^<]*)</loc>', r.text)
        if not subs:
            # Try all sub-sitemaps
            subs = re.findall(r'<loc>([^<]+)</loc>', r.text)
        for sm_url in subs:
            try:
                r2 = requests.get(sm_url, timeout=8, headers=HEADERS, verify=False)
                if r2.status_code == 200:
                    urls = re.findall(r'<loc>([^<]+)</loc>', r2.text)
                    for u in urls:
                        if '/product/' in u or '/shop/' in u:
                            product_urls.append(unescape(u))
            except:
                continue
            time.sleep(0.2)
    except:
        pass
    return list(dict.fromkeys(product_urls))

def scrape_product_html(url):
    """Scrape a single product page via HTML meta tags and JSON-LD."""
    try:
        r = requests.get(url, timeout=8, headers=HEADERS, verify=False)
        if r.status_code != 200:
            return None
        html = r.text

        title = None
        price = None
        image = None
        available = True

        # JSON-LD
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
            try:
                ld = json.loads(m.group(1))
                if isinstance(ld, dict) and ld.get("@type") == "Product":
                    title = ld.get("name")
                    image = ld.get("image", [None])
                    if isinstance(image, list):
                        image = image[0] if image else None
                    offers = ld.get("offers", {})
                    if isinstance(offers, list):
                        offers = offers[0] if offers else {}
                    price = offers.get("price")
                    avail = offers.get("availability", "")
                    available = "InStock" in avail if avail else True
                    break
                elif isinstance(ld, dict) and ld.get("@graph"):
                    for item in ld["@graph"]:
                        if item.get("@type") == "Product":
                            title = item.get("name")
                            image = item.get("image")
                            if isinstance(image, list):
                                image = image[0] if image else None
                            offers = item.get("offers", {})
                            if isinstance(offers, list):
                                offers = offers[0] if offers else {}
                            price = offers.get("price")
                            avail = offers.get("availability", "")
                            available = "InStock" in avail if avail else True
                            break
            except:
                continue

        # Fallback to meta tags
        if not title:
            m = re.search(r'<meta property="og:title" content="([^"]+)"', html)
            if m:
                title = unescape(m.group(1))
        if not price:
            m = re.search(r'<meta property="product:price:amount" content="([^"]+)"', html)
            if m:
                price = m.group(1)
        if not image:
            m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
            if m:
                image = m.group(1)

        if not title:
            m = re.search(r'<title>([^<]+)</title>', html)
            if m:
                title = unescape(m.group(1).split("|")[0].split("–")[0].strip())

        if title:
            handle = url.rstrip("/").split("/")[-1]
            return {
                "title": title,
                "handle": handle,
                "price": str(price) if price else None,
                "available": available,
                "image": image,
                "url": url,
                "product_type": "",
                "vendor": "",
                "tags": [],
            }
    except:
        pass
    return None


# Load WooCommerce stores
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    companies = json.load(f)

woo_stores = [(c["name"], c["website"].rstrip("/"), c.get("industry", ""))
              for c in companies
              if c.get("ecommerce_platform") == "WooCommerce" and c.get("website")]

log(f"Scraping {len(woo_stores)} WooCommerce stores...\n")

all_products = []
store_results = {}

for name, base_url, industry in sorted(woo_stores):
    products = []

    # Method 1: Store API
    products = scrape_via_store_api(base_url)
    method = "store-api"

    # Method 2: Sitemap + HTML if API fails
    if not products:
        product_urls = find_product_urls_from_sitemap(base_url)
        if product_urls:
            method = "sitemap+html"
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = {executor.submit(scrape_product_html, url): url for url in product_urls}
                for future in as_completed(futures):
                    result = future.result()
                    if result:
                        products.append(result)

    # Method 3: Try /shop page for product links
    if not products:
        method = "shop-page"
        try:
            for path in ["/shop", "/shop/", "/products", "/store"]:
                r = requests.get(f"{base_url}{path}", timeout=8, headers=HEADERS, verify=False)
                if r.status_code == 200 and "/product/" in r.text:
                    urls = re.findall(r'href="([^"]*?/product/[^"]+)"', r.text)
                    urls = list(dict.fromkeys([unescape(u) for u in urls]))
                    if urls:
                        with ThreadPoolExecutor(max_workers=5) as executor:
                            futures = {executor.submit(scrape_product_html, url): url for url in urls}
                            for future in as_completed(futures):
                                result = future.result()
                                if result:
                                    products.append(result)
                        break
        except:
            pass

    for p in products:
        p["store_name"] = name

    all_products.extend(products)
    store_results[name] = {"count": len(products), "method": method, "industry": industry}
    log(f"  {name}: {len(products)} products (via {method})")
    time.sleep(0.5)

# Save
with open('/Applications/worker-owned/purposeowned/bcorp_products_woocommerce.json', 'w') as f:
    json.dump(all_products, f, indent=2)

log(f"\n=== RESULTS ===")
log(f"Stores scraped: {len(store_results)}")
log(f"With products: {len([r for r in store_results.values() if r['count'] > 0])}")
log(f"Total products: {len(all_products)}")
log(f"\nSaved to purposeowned/bcorp_products_woocommerce.json")
