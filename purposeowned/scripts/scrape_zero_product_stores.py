"""
Scrape zero-product stores identified in COVERAGE.md.

Fixable stores:
1. Annmarie Skin Care - Shopify at shop.annmariegianni.com (/products.json)
2. Mountain Rose Herbs - BigCommerce, HTML scraping of category pages
3. King Arthur Baking - BigCommerce at shop.kingarthurbaking.com, HTML scraping
4. Lake Champlain Chocolates - BigCommerce, HTML scraping of category pages
5. Cariloha - BigCommerce, HTML scraping of category pages
"""

import json
import re
import time
import requests
import urllib3
from html import unescape
from urllib.parse import urlparse, urljoin

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

OUTPUT_FILE = "/Applications/worker-owned/purposeowned/products_zero_fixed.json"


# -- 1. Annmarie Skin Care (Shopify) --

def scrape_annmarie():
    """Scrape via Shopify /products.json at shop.annmariegianni.com."""
    base = "https://shop.annmariegianni.com"
    store_name = "Annmarie Skin Care"
    products = []
    page = 1

    while page <= 50:
        url = f"{base}/products.json?limit=250&page={page}"
        try:
            r = requests.get(url, timeout=15, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            data = r.json()
            batch = data.get("products", [])
            if not batch:
                break

            for p in batch:
                variants = p.get("variants", [])
                images = p.get("images", [])
                price = variants[0]["price"] if variants else None
                image = images[0]["src"] if images else None
                available = any(v.get("available", False) for v in variants) if variants else False
                tags = p.get("tags", []) if isinstance(p.get("tags"), list) \
                       else [t.strip() for t in p.get("tags", "").split(",") if t.strip()]

                products.append({
                    "title": p.get("title", ""),
                    "handle": p.get("handle", ""),
                    "price": price,
                    "available": available,
                    "image": image,
                    "url": f"{base}/products/{p.get('handle', '')}",
                    "product_type": p.get("product_type", ""),
                    "vendor": p.get("vendor", ""),
                    "tags": tags,
                    "store_name": store_name,
                })
            page += 1
            time.sleep(0.5)
        except Exception as e:
            log(f"  Error page {page}: {e}")
            break

    return products


# -- BigCommerce HTML scraper helper --

def scrape_bigcommerce_category(base_url, category_path, store_name, max_pages=20):
    """Scrape product listing from a BigCommerce category page using HTML parsing."""
    products = []
    seen_titles = set()

    for page in range(1, max_pages + 1):
        url = f"{base_url}{category_path}" if page == 1 else f"{base_url}{category_path}?page={page}"
        try:
            r = requests.get(url, timeout=15, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            html = r.text

            # Method 1: LD+JSON
            for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
                try:
                    ld = json.loads(m.group(1))
                    items = []
                    if isinstance(ld, dict) and ld.get("@type") == "ItemList":
                        items = ld.get("itemListElement", [])
                    elif isinstance(ld, dict) and ld.get("@graph"):
                        items = [i for i in ld["@graph"] if isinstance(i, dict) and i.get("@type") == "Product"]
                    elif isinstance(ld, dict) and ld.get("@type") == "Product":
                        items = [ld]
                    elif isinstance(ld, list):
                        items = [i for i in ld if isinstance(i, dict) and i.get("@type") == "Product"]

                    for item in items:
                        prod = item.get("item", item)
                        title = unescape(prod.get("name", "")).strip()
                        if not title or title in seen_titles:
                            continue
                        seen_titles.add(title)
                        offers = prod.get("offers", {})
                        if isinstance(offers, list):
                            offers = offers[0] if offers else {}
                        price = offers.get("price") or offers.get("lowPrice")
                        image = prod.get("image")
                        if isinstance(image, list): image = image[0] if image else None
                        if isinstance(image, dict): image = image.get("url")
                        prod_url = prod.get("url", "")
                        if prod_url and not prod_url.startswith("http"):
                            prod_url = f"{base_url}{prod_url}"

                        products.append({
                            "title": title,
                            "handle": prod_url.rstrip("/").split("/")[-1] if prod_url else "",
                            "price": str(price) if price else None,
                            "available": "InStock" in str(offers.get("availability", "InStock")),
                            "image": image,
                            "url": prod_url or base_url,
                            "product_type": prod.get("category", "") or "",
                            "vendor": prod.get("brand", {}).get("name", "") if isinstance(prod.get("brand"), dict) else "",
                            "tags": [],
                            "store_name": store_name,
                        })
                except:
                    continue

            # Method 2: Parse product cards from HTML
            card_patterns = [
                r'data-name="([^"]+)"[^>]*data-product-price="([^"]*)"',
                r'<h\d[^>]*class="[^"]*card-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>\s*([^<]+)',
            ]

            for pattern in card_patterns:
                for match in re.finditer(pattern, html):
                    if len(match.groups()) == 2:
                        g1, g2 = match.group(1), match.group(2)
                        if g1.startswith("/") or g1.startswith("http"):
                            prod_url = g1 if g1.startswith("http") else f"{base_url}{g1}"
                            title = unescape(g2).strip()
                        else:
                            title = unescape(g1).strip()
                            prod_url = ""

                        if title and title not in seen_titles:
                            seen_titles.add(title)
                            products.append({
                                "title": title,
                                "handle": prod_url.rstrip("/").split("/")[-1] if prod_url else title.lower().replace(" ", "-"),
                                "price": None,
                                "available": True,
                                "image": None,
                                "url": prod_url or base_url,
                                "product_type": "",
                                "vendor": "",
                                "tags": [],
                                "store_name": store_name,
                            })

            # Check if next page exists
            if f'page={page+1}' not in html and 'page-next' not in html:
                break
            time.sleep(0.5)
        except Exception as e:
            log(f"  Error on {url}: {e}")
            break

    return products


def scrape_bigcommerce_product_page(url, store_name):
    """Scrape a single BigCommerce product page for LD+JSON or HTML data."""
    try:
        r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
        if r.status_code != 200:
            return None
        html = r.text

        # Try LD+JSON first
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
                        "store_name": store_name,
                    }
            except:
                continue

        # Fallback: parse HTML for og:title, og:image, price
        title_m = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
        price_m = re.search(r'data-product-price-without-tax="([^"]*)"', html) or \
                  re.search(r'"price":\s*\{[^}]*"without_tax":\s*\{[^}]*"value":\s*([\d.]+)', html) or \
                  re.search(r'class="price[^"]*"[^>]*>\s*\$\s*([\d,]+\.?\d*)', html)
        img_m = re.search(r'property="og:image"\s+content="([^"]+)"', html) or \
                re.search(r'data-zoom-image="([^"]+)"', html)

        if title_m:
            title = unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip()
            price = None
            if price_m:
                price_str = price_m.group(1)
                price_str = re.sub(r'[,$]', '', price_str)
                try:
                    price = str(float(price_str))
                except:
                    price = None
            image = img_m.group(1) if img_m else None
            return {
                "title": title,
                "handle": url.rstrip("/").split("/")[-1],
                "price": price,
                "available": True,
                "image": image,
                "url": url,
                "product_type": "",
                "vendor": "",
                "tags": [],
                "store_name": store_name,
            }
    except:
        pass
    return None


# -- 2. Mountain Rose Herbs (BigCommerce) --

MOUNTAIN_ROSE_CATEGORIES = [
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

def scrape_mountain_rose():
    """Scrape Mountain Rose Herbs category pages."""
    base = "https://mountainroseherbs.com"
    store_name = "Mountain Rose Herbs"
    all_products = []
    seen = set()

    for cat in MOUNTAIN_ROSE_CATEGORIES:
        cat_products = scrape_bigcommerce_category(base, cat, store_name, max_pages=10)
        for p in cat_products:
            if p["title"] not in seen:
                seen.add(p["title"])
                all_products.append(p)
        log(f"  {cat}: {len(cat_products)} products")
        time.sleep(0.5)

    # If category scraping got nothing, try finding and scraping individual product pages
    if not all_products:
        log("  Category LD+JSON failed. Finding product links...")
        product_urls = set()
        for cat in MOUNTAIN_ROSE_CATEGORIES:
            try:
                r = requests.get(f"{base}{cat}", timeout=15, headers=HEADERS, verify=False)
                if r.status_code == 200:
                    links = re.findall(r'href="(https://mountainroseherbs\.com/[a-z0-9][a-z0-9-]*)"', r.text)
                    for link in links:
                        path = urlparse(link).path.strip("/")
                        if "/" not in path and path not in ["catalog", "about", "blog", "contact",
                            "wholesale", "search", "cart", "account", "login", "register",
                            "herbs-spices", "teas", "essential-oils", "herbs-for-health",
                            "natural-body-products", "culinary-delights", "ingredients",
                            "home-goods", "containers", "books"]:
                            product_urls.add(link)
                time.sleep(0.3)
            except:
                continue

        log(f"  Found {len(product_urls)} potential product URLs")
        count = 0
        for url in sorted(product_urls):
            prod = scrape_bigcommerce_product_page(url, store_name)
            if prod and prod["title"] not in seen:
                seen.add(prod["title"])
                all_products.append(prod)
                count += 1
                if count % 50 == 0:
                    log(f"  ... scraped {count} products so far")
            time.sleep(0.25)

    return all_products


# -- 3. King Arthur Baking (BigCommerce) --

KING_ARTHUR_CATEGORIES = [
    "/flours/signature",
    "/flours/specialty",
    "/flours/gluten-free",
    "/flours/whole-grain",
    "/mixes",
    "/ingredients/vanilla",
    "/ingredients/chocolate",
    "/ingredients/sugars-sweeteners",
    "/ingredients/fruits-nuts",
    "/ingredients/flavors-spices",
    "/ingredients/baking-essentials",
    "/pans",
    "/tools",
    "/collections/best-sellers",
    "/collections/new-arrivals",
    "/collections/recipe-bundles",
    "/sale",
    "/special-savings",
    "/gluten-free",
]

def scrape_king_arthur():
    """Scrape King Arthur Baking from shop.kingarthurbaking.com."""
    base = "https://shop.kingarthurbaking.com"
    store_name = "King Arthur Baking Company"
    all_products = []
    seen = set()

    for cat in KING_ARTHUR_CATEGORIES:
        # Try with show=96 to get more products per page
        cat_products = scrape_bigcommerce_category(base, cat, store_name, max_pages=10)
        for p in cat_products:
            if p["title"] not in seen:
                seen.add(p["title"])
                all_products.append(p)
        log(f"  {cat}: {len(cat_products)} products (total unique: {len(all_products)})")
        time.sleep(0.5)

    # If category didn't work, try individual product pages
    if not all_products:
        log("  Category scraping failed. Finding product links...")
        product_urls = set()
        for cat in KING_ARTHUR_CATEGORIES:
            try:
                for pg in range(1, 5):
                    url = f"{base}{cat}" if pg == 1 else f"{base}{cat}?page={pg}"
                    r = requests.get(url, timeout=15, headers=HEADERS, verify=False)
                    if r.status_code != 200:
                        break
                    links = re.findall(r'href="([^"]+)"', r.text)
                    for link in links:
                        full = link if link.startswith("http") else f"{base}{link}"
                        parsed = urlparse(full)
                        if parsed.netloc != "shop.kingarthurbaking.com":
                            continue
                        path = parsed.path.strip("/")
                        parts = path.split("/")
                        if len(parts) >= 2 and parts[0] in ["flours", "mixes", "ingredients", "pans", "tools"]:
                            product_urls.add(full)
                    if f'page={pg+1}' not in r.text:
                        break
                    time.sleep(0.3)
            except:
                continue

        log(f"  Found {len(product_urls)} potential product URLs")
        count = 0
        for url in sorted(product_urls):
            prod = scrape_bigcommerce_product_page(url, store_name)
            if prod and prod["title"] not in seen:
                seen.add(prod["title"])
                all_products.append(prod)
                count += 1
                if count % 20 == 0:
                    log(f"  ... scraped {count} products so far")
            time.sleep(0.25)

    return all_products


# -- 4. Lake Champlain Chocolates (BigCommerce) --

LAKE_CHAMPLAIN_CATEGORIES = [
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
]

def scrape_lake_champlain():
    """Scrape Lake Champlain Chocolates category pages."""
    base = "https://lakechamplainchocolates.com"
    store_name = "Lake Champlain Chocolates"
    all_products = []
    seen = set()

    for cat in LAKE_CHAMPLAIN_CATEGORIES:
        cat_products = scrape_bigcommerce_category(base, cat, store_name, max_pages=5)
        for p in cat_products:
            if p["title"] not in seen:
                seen.add(p["title"])
                all_products.append(p)
        log(f"  {cat}: {len(cat_products)} products (total unique: {len(all_products)})")
        time.sleep(0.5)

    # If category didn't work, try individual pages
    if not all_products:
        log("  Category scraping failed. Finding product links...")
        product_urls = set()
        for cat in LAKE_CHAMPLAIN_CATEGORIES:
            try:
                r = requests.get(f"{base}{cat}", timeout=15, headers=HEADERS, verify=False)
                if r.status_code == 200:
                    links = re.findall(r'href="(https://[^"]*lakechamplain[^"]*)"', r.text)
                    for link in links:
                        path = urlparse(link).path.strip("/")
                        parts = path.split("/")
                        if len(parts) >= 2 and not path.endswith("/"):
                            product_urls.add(link)
                time.sleep(0.3)
            except:
                continue

        log(f"  Found {len(product_urls)} potential product URLs")
        count = 0
        for url in sorted(product_urls):
            prod = scrape_bigcommerce_product_page(url, store_name)
            if prod and prod["title"] not in seen:
                seen.add(prod["title"])
                all_products.append(prod)
                count += 1
                if count % 20 == 0:
                    log(f"  ... scraped {count} products so far")
            time.sleep(0.25)

    return all_products


# -- 5. Cariloha (BigCommerce) --

CARILOHA_CATEGORIES = [
    "/bed/bedding/",
    "/bed/bedding/sheets",
    "/bed/bedding/blankets",
    "/bed/bundles/bedding-suites/",
    "/apparel/womens",
    "/apparel/mens",
    "/apparel/sleepwear",
    "/bath/bath/",
    "/bath/bath/robes",
]

def scrape_cariloha():
    """Scrape Cariloha category pages."""
    base = "https://www.cariloha.com"
    store_name = "Cariloha"
    all_products = []
    seen = set()

    for cat in CARILOHA_CATEGORIES:
        cat_products = scrape_bigcommerce_category(base, cat, store_name, max_pages=10)
        for p in cat_products:
            if p["title"] not in seen:
                seen.add(p["title"])
                all_products.append(p)
        log(f"  {cat}: {len(cat_products)} products (total unique: {len(all_products)})")
        time.sleep(0.5)

    # If category didn't work, try individual product pages
    if not all_products:
        log("  Category scraping failed. Finding product links...")
        product_urls = set()
        for cat in CARILOHA_CATEGORIES:
            try:
                r = requests.get(f"{base}{cat}", timeout=15, headers=HEADERS, verify=False)
                if r.status_code == 200:
                    links = re.findall(r'href="(https://www\.cariloha\.com/[a-z0-9][a-z0-9-]*/?")', r.text)
                    for link in links:
                        path = urlparse(link).path.strip("/")
                        if "/" not in path and path not in ["bed", "bath", "apparel", "cart",
                            "account", "login", "register", "search", "contact", "about",
                            "sale", "gift-cards", "rewards", ""]:
                            product_urls.add(link)
                time.sleep(0.3)
            except:
                continue

        log(f"  Found {len(product_urls)} potential product URLs")
        count = 0
        for url in sorted(product_urls):
            prod = scrape_bigcommerce_product_page(url, store_name)
            if prod and prod["title"] not in seen:
                seen.add(prod["title"])
                all_products.append(prod)
                count += 1
                if count % 20 == 0:
                    log(f"  ... scraped {count} products so far")
            time.sleep(0.25)

    return all_products


# -- Main --

if __name__ == "__main__":
    all_products = []

    log("=" * 60)
    log("Scraping zero-product stores")
    log("=" * 60)

    # 1. Annmarie (Shopify)
    log("\n[1/5] Annmarie Skin Care (Shopify)...")
    annmarie = scrape_annmarie()
    all_products.extend(annmarie)
    log(f"  => {len(annmarie)} products")

    # 2. Mountain Rose Herbs (BigCommerce)
    log("\n[2/5] Mountain Rose Herbs (BigCommerce)...")
    mrose = scrape_mountain_rose()
    all_products.extend(mrose)
    log(f"  => {len(mrose)} products")

    # 3. King Arthur (BigCommerce)
    log("\n[3/5] King Arthur Baking Company (BigCommerce)...")
    ka = scrape_king_arthur()
    all_products.extend(ka)
    log(f"  => {len(ka)} products")

    # 4. Lake Champlain (BigCommerce)
    log("\n[4/5] Lake Champlain Chocolates (BigCommerce)...")
    lcc = scrape_lake_champlain()
    all_products.extend(lcc)
    log(f"  => {len(lcc)} products")

    # 5. Cariloha (BigCommerce)
    log("\n[5/5] Cariloha (BigCommerce)...")
    cariloha = scrape_cariloha()
    all_products.extend(cariloha)
    log(f"  => {len(cariloha)} products")

    # Save intermediate results
    with open(OUTPUT_FILE, "w") as f:
        json.dump(all_products, f, indent=2)

    log(f"\n{'=' * 60}")
    log(f"RESULTS")
    log(f"{'=' * 60}")
    stores = {}
    for p in all_products:
        stores[p["store_name"]] = stores.get(p["store_name"], 0) + 1
    for name, count in sorted(stores.items()):
        log(f"  {name}: {count} products")
    log(f"  TOTAL: {len(all_products)} products from {len(stores)} stores")
    log(f"  Saved to {OUTPUT_FILE}")
