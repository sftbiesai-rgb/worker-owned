"""Scrape Lake Champlain Chocolates - find product URLs from all category pages, then scrape each."""
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

BASE = "https://www.lakechamplainchocolates.com"
STORE_NAME = "Lake Champlain Chocolates"

CATEGORY_PAGES = [
    "/chocolate-gifts/best-sellers/",
    "/chocolate/assortments/",
    "/chocolate-gifts/gift-baskets-and-samplers/",
    "/chocolate-gifts/chocolate-gift-boxes/",
    "/chocolate-gifts/halloween-chocolates/",
    "/chocolate-gifts/thanksgiving-chocolates/",
    "/chocolate-gifts/birthday-chocolates/",
    "/chocolate-gifts/thinking-of-you-chocolate/",
    "/chocolate-gifts/thank-you-chocolates/",
    "/chocolate-gifts/anniversary-chocolates/",
    "/chocolate-gifts/wedding-party/",
    "/chocolate-gifts/gourmet-gifts/",
    "/chocolate-gifts/custom-chocolate-gifts/",
    "/chocolate-gifts/vegan-chocolates/",
    "/chocolate-gifts/under-25/",
    "/chocolate-gifts/between-25-50/",
    "/chocolate-gifts/between-50-100/",
    "/chocolate-gifts/over-100/",
    "/chocolate-gifts/vermont-made-gifts/",
    "/chocolate-gifts/merchandise/",
    "/seasonal-chocolates/fall-gift-boxes-and-more/",
    "/seasonal-chocolates/chocolate-leaves/",
    "/seasonal-chocolates/chocolate-turkeys/",
    "/seasonal-chocolates/comfort-chocolate/",
    "/seasonal-chocolates/halloween-chocolates/",
    "/seasonal-chocolates/new/",
    "/seasonal-chocolates/sale/",
    "/seasonal-chocolates/smores-gifts/",
    "/seasonal-chocolates/swedish-candy-and-more/",
    "/chocolate/chocolate-bars/",
    "/chocolate/chocolate-caramels/",
    "/chocolate/chocolate-clusters/",
    "/chocolate/chocolate-coins/",
    "/chocolate/chocolate-snacks/",
    "/chocolate/chocolate-squares/",
    "/chocolate/chocolates-of-vermont/",
    "/chocolate/dark-chocolate/",
    "/chocolate/english-toffee/",
    "/chocolate/fruits-and-nuts/",
    "/chocolate/handcrafted-chocolate/",
    "/chocolate/keto-chocolate/",
    "/chocolate/milk-chocolate/",
    "/chocolate/organic/",
    "/chocolate/peanut-butter/",
    "/chocolate/sea-salt-caramels/",
    "/chocolate/vegan/",
    "/chocolate/baking-chocolate/",
    "/chocolate/bulk-chocolates/",
    "/truffles/",
    "/hot-chocolate/",
    "/corporate-gifts/",
]

SKIP_SLUGS = {
    "", "chocolate-gifts", "chocolate", "seasonal-chocolates", "our-chocolate",
    "corporate-gifts", "account.php", "cart.php", "login.php", "register",
    "search", "about", "contact", "blog", "faq", "shipping", "returns",
    "gift-card", "win-free-chocolate", "chocolate-101", "truffles",
    "hot-chocolate", "account",
}


def find_product_urls():
    """Crawl category pages to find all product URLs."""
    product_urls = set()
    for cat in CATEGORY_PAGES:
        page = 1
        while page <= 5:
            url = f"{BASE}{cat}" if page == 1 else f"{BASE}{cat}?page={page}"
            try:
                r = requests.get(url, timeout=15, headers=HEADERS, verify=False)
                if r.status_code != 200:
                    break
                html = r.text
                # Find full-domain product links  
                links = re.findall(r'href="(https://www\.lakechamplainchocolates\.com/([a-z0-9][a-z0-9-]*/?))"', html)
                for full_url, slug in links:
                    slug = slug.strip("/")
                    if slug not in SKIP_SLUGS and "/" not in slug and not slug.endswith(".php"):
                        product_urls.add(full_url.rstrip("/"))

                # Also find relative product links (root-level slugs)
                rel_links = re.findall(r'href="/([a-z0-9][a-z0-9-]*/?)(?:\?[^"]*)?(?:#[^"]*)?(?:")', html)
                for slug in rel_links:
                    slug = slug.strip("/")
                    if slug not in SKIP_SLUGS and "/" not in slug and not slug.endswith(".php"):
                        product_urls.add(f"{BASE}/{slug}")

                if f'page={page+1}' not in html:
                    break
                page += 1
                time.sleep(0.3)
            except Exception as e:
                log(f"  {cat}: Error {e}")
                break
        time.sleep(0.2)
    return sorted(product_urls)


def scrape_product(url):
    """Scrape one product page."""
    try:
        r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
        if r.status_code != 200:
            return None
        html = r.text

        # Check if this is actually a product page (has Add to Cart)
        is_product = bool(re.search(r'add.to.cart|addtocart|btn--cart', html, re.I))
        if not is_product:
            return None

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

        # Fallback: og:title + price
        title_m = re.search(r'property="og:title"\s+content="([^"]+)"', html)
        img_m = re.search(r'property="og:image"\s+content="([^"]+)"', html)
        price_m = re.search(r'data-product-price-without-tax="([^"]*)"', html) or \
                  re.search(r'"without_tax":\s*\{[^}]*"value":\s*([\d.]+)', html) or \
                  re.search(r'class="price--withoutTax[^"]*"[^>]*>\s*\$\s*([\d,.]+)', html) or \
                  re.search(r'\$\s*([\d,.]+)', html)

        if title_m:
            title = unescape(title_m.group(1)).strip()
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
                "vendor": "Lake Champlain Chocolates",
                "tags": [],
                "store_name": STORE_NAME,
            }
    except:
        pass
    return None


if __name__ == "__main__":
    log("Finding product URLs from category pages...")
    urls = find_product_urls()
    log(f"Found {len(urls)} unique potential product URLs\n")

    products = []
    seen = set()

    log("Scraping individual pages...")
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(scrape_product, u): u for u in urls}
        done = 0
        for future in as_completed(futures):
            done += 1
            result = future.result()
            if result and result["title"] not in seen:
                seen.add(result["title"])
                products.append(result)
            if done % 20 == 0:
                log(f"  ... {done}/{len(urls)} pages, {len(products)} products")

    out = "/Applications/worker-owned/purposeowned/products_lake_champlain.json"
    with open(out, "w") as f:
        json.dump(products, f, indent=2)

    log(f"\n=== RESULTS ===")
    log(f"URLs checked: {len(urls)}")
    log(f"Products found: {len(products)}")
    log(f"Saved to {out}")
