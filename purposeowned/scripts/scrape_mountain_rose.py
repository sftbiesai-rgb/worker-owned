"""Scrape Mountain Rose Herbs - find all product URLs from category pages, then scrape each."""
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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

BASE = "https://mountainroseherbs.com"
STORE_NAME = "Mountain Rose Herbs"

CATEGORIES = [
    "/catalog/herbs-spices",
    "/catalog/teas",
    "/catalog/essential-oils",
    "/catalog/herbs-for-health",
    "/catalog/natural-body-products",
    "/catalog/culinary-delights",
    "/catalog/ingredients",
    "/catalog/home-goods",
    "/catalog/containers",
    "/catalog/books",
]

SKIP_SLUGS = {
    "catalog", "about", "blog", "contact", "wholesale", "search", "cart",
    "account", "login", "register", "pages", "journal", "collections",
    "brands", "sitemap", "sitemap.xml", "customer", "wishlist", "compare",
    "rss", "feeds", "", "herbs-spices", "teas", "essential-oils",
    "herbs-for-health", "natural-body-products", "culinary-delights",
    "ingredients", "home-goods", "containers", "books", "free-shipping",
    "sustainability", "quality", "freshness-guarantee",
}


def find_product_urls():
    """Crawl category pages to find all product URLs."""
    product_urls = set()
    for cat in CATEGORIES:
        page = 1
        while page <= 20:
            url = f"{BASE}{cat}" if page == 1 else f"{BASE}{cat}?page={page}"
            try:
                r = requests.get(url, timeout=15, headers=HEADERS, verify=False)
                if r.status_code != 200:
                    break
                html = r.text
                links = re.findall(r'href="(https://mountainroseherbs\.com/([a-z0-9][a-z0-9-]*))"', html)
                before = len(product_urls)
                for full_url, slug in links:
                    if slug not in SKIP_SLUGS and "/" not in slug:
                        product_urls.add(full_url)
                after = len(product_urls)
                new = after - before
                if new == 0 and page > 1:
                    break
                # Check for next page
                if f'page={page+1}' not in html:
                    break
                page += 1
                time.sleep(0.3)
            except Exception as e:
                log(f"  Error {url}: {e}")
                break
        log(f"  {cat}: found {len(product_urls)} total URLs so far")
        time.sleep(0.3)
    return sorted(product_urls)


def scrape_product(url):
    """Scrape one product page."""
    try:
        r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
        if r.status_code != 200:
            return None
        html = r.text

        # LD+JSON
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
                    return {
                        "title": unescape(item.get("name", "")),
                        "handle": url.rstrip("/").split("/")[-1],
                        "price": str(price) if price else None,
                        "available": "InStock" in str(offers.get("availability", "InStock")),
                        "image": image,
                        "url": url,
                        "product_type": item.get("category", "") or "",
                        "vendor": item.get("brand", {}).get("name", "") if isinstance(item.get("brand"), dict) else "",
                        "tags": [],
                        "store_name": STORE_NAME,
                    }
            except:
                continue

        # Fallback: og:title + og:image + price from HTML
        title_m = re.search(r'property="og:title"\s+content="([^"]+)"', html) or \
                  re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
        img_m = re.search(r'property="og:image"\s+content="([^"]+)"', html)
        price_m = re.search(r'class="price[^"]*"[^>]*>\s*\$\s*([\d,.]+)', html) or \
                  re.search(r'data-product-price="([\d.]+)"', html)

        if title_m:
            title = unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip()
            # Skip non-product pages
            if title.lower() in SKIP_SLUGS or "catalog" in title.lower():
                return None
            price = None
            if price_m:
                ps = re.sub(r'[,$]', '', price_m.group(1))
                try: price = str(float(ps))
                except: pass
            return {
                "title": title,
                "handle": url.rstrip("/").split("/")[-1],
                "price": price,
                "available": True,
                "image": img_m.group(1) if img_m else None,
                "url": url,
                "product_type": "",
                "vendor": "Mountain Rose Herbs",
                "tags": [],
                "store_name": STORE_NAME,
            }
    except:
        pass
    return None


if __name__ == "__main__":
    log("Finding product URLs from category pages...")
    urls = find_product_urls()
    log(f"Found {len(urls)} unique product URLs\n")

    products = []
    seen = set()

    log("Scraping individual product pages...")
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(scrape_product, u): u for u in urls}
        done = 0
        for future in as_completed(futures):
            done += 1
            result = future.result()
            if result and result["title"] not in seen:
                seen.add(result["title"])
                products.append(result)
            if done % 50 == 0:
                log(f"  ... {done}/{len(urls)} pages, {len(products)} products")

    out = "/Applications/worker-owned/purposeowned/products_mountain_rose.json"
    with open(out, "w") as f:
        json.dump(products, f, indent=2)

    log(f"\n=== RESULTS ===")
    log(f"URLs scraped: {len(urls)}")
    log(f"Products found: {len(products)}")
    log(f"Saved to {out}")
