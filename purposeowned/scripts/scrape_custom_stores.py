"""Custom scrapers for large/nonstandard stores: Patagonia, King Arthur, Cariloha, Lake Champlain, Torani."""
import json
import re
import time
import requests
import urllib3
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

BASE_DIR = "/Applications/worker-owned/purposeowned"

def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# 1. TORANI (Magento) - paginated category listing at /products.html
# ---------------------------------------------------------------------------
def scrape_torani():
    """Scrape Torani products from Magento paginated listing pages."""
    log("\n=== TORANI (Magento) ===")
    base = "https://www.torani.com"
    products = []
    seen_urls = set()

    # Torani has ~192 products, 12 per page = 16 pages
    for page in range(1, 25):
        url = f"{base}/products.html" if page == 1 else f"{base}/products.html?p={page}"
        try:
            r = requests.get(url, timeout=15, headers=HEADERS, verify=False)
            if r.status_code != 200:
                log(f"  Page {page}: HTTP {r.status_code}, stopping")
                break

            html = r.text

            # Extract product links from listing page
            # Torani uses product-item-link class
            name_matches = re.findall(
                r'<a[^>]*class="product-item-link"[^>]*href="([^"]+)"[^>]*>\s*([^<]+?)\s*</a>',
                html, re.DOTALL
            )

            if not name_matches:
                # Alternative: find product links with titles
                name_matches = re.findall(
                    r'href="(https://www\.torani\.com/(?!products|customer|checkout|catalogsearch|media|static|pub)[a-z0-9-]+\.html)"[^>]*>\s*([^<]{3,}?)\s*<',
                    html
                )

            page_count = 0
            for prod_url, name in name_matches:
                name = unescape(name.strip())
                if not name or len(name) < 2:
                    continue
                if prod_url in seen_urls:
                    continue
                if any(x in prod_url for x in ['/products.html', '/customer/', '/checkout/', '/catalogsearch/']):
                    continue
                seen_urls.add(prod_url)
                products.append({
                    "title": name,
                    "handle": prod_url.rstrip("/").split("/")[-1].replace(".html", ""),
                    "price": None,
                    "available": True,
                    "image": None,
                    "url": prod_url,
                    "product_type": "Syrups & Sauces",
                    "vendor": "Torani",
                    "tags": [],
                    "store_name": "R. Torre & Company (Torani)",
                })
                page_count += 1

            log(f"  Page {page}: found {page_count} new products (total {len(products)})")

            if f"p={page+1}" not in html and page > 1:
                log(f"  No more pages after {page}")
                break
            time.sleep(0.5)
        except Exception as e:
            log(f"  Page {page} error: {e}")
            break

    # Fetch individual product pages for price/image
    log(f"  Fetching details for {len(products)} products...")

    def fetch_torani_detail(prod):
        try:
            r = requests.get(prod["url"], timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                return prod
            html = r.text
            price_match = re.search(r'"price":\s*(\d+\.?\d*)', html)
            if price_match:
                prod["price"] = str(price_match.group(1))
            else:
                price_match = re.search(r'\$(\d+\.\d{2})', html)
                if price_match:
                    prod["price"] = price_match.group(1)
            img_match = re.search(
                r'(?:src|content)="(https://www\.torani\.com/media/catalog/product/[^"]+\.(?:png|jpg|jpeg))"', html
            )
            if img_match:
                prod["image"] = img_match.group(1)
            cat_match = re.search(r'"item_category2":\s*"([^"]+)"', html)
            if cat_match:
                prod["product_type"] = cat_match.group(1)
            stock_match = re.search(r'"item_stock_status":\s*"([^"]+)"', html)
            if stock_match:
                prod["available"] = "in stock" in stock_match.group(1).lower()
        except:
            pass
        return prod

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_torani_detail, p): p for p in products}
        done = 0
        for f in as_completed(futures):
            done += 1
            if done % 20 == 0:
                log(f"    {done}/{len(products)} detailed...")
            time.sleep(0.15)

    log(f"  TOTAL: {len(products)} Torani products")
    return products


# ---------------------------------------------------------------------------
# 2. KING ARTHUR BAKING (BigCommerce at shop.kingarthurbaking.com)
# ---------------------------------------------------------------------------
def scrape_king_arthur():
    """Scrape King Arthur Baking from BigCommerce category pages."""
    log("\n=== KING ARTHUR BAKING (BigCommerce) ===")
    base = "https://shop.kingarthurbaking.com"
    seen_urls = set()
    products = []

    categories = [
        "/mixes", "/flours", "/ingredients", "/pans", "/tools",
        "/gluten-free", "/sale", "/special-savings",
        "/collections/best-sellers", "/collections/new-arrivals",
        "/collections/recipe-bundles", "/collections/sourdough-savvy",
        "/collections/all-things-pumpkin", "/collections/halloween",
        "/on-demand-classes", "/flours/signature", "/gluten-free/mixes",
        "/ingredients/vanilla", "/pans/mix-pan-sets",
        "/select/maple", "/tool-pan-sets",
    ]

    for cat in categories:
        for page in range(1, 10):
            url = f"{base}{cat}" if page == 1 else f"{base}{cat}?page={page}"
            try:
                r = requests.get(url, timeout=15, headers=HEADERS, verify=False, allow_redirects=True)
                if r.status_code != 200:
                    break
                html = r.text
                item_matches = re.findall(
                    r'href="(?:https://shop\.kingarthurbaking\.com)?(/(?:items|classes)/([^"?#]+))"', html
                )
                page_count = 0
                for path, slug in item_matches:
                    prod_url = f"{base}{path}"
                    if prod_url in seen_urls:
                        continue
                    seen_urls.add(prod_url)
                    page_count += 1
                if page_count == 0 and page > 1:
                    break
                if f"page={page+1}" not in html and page > 1:
                    break
                time.sleep(0.3)
            except Exception as e:
                log(f"  {cat} page {page} error: {e}")
                break

    unique_urls = sorted(seen_urls)
    log(f"  Found {len(unique_urls)} unique product URLs across categories")

    def fetch_ka_product(prod_url):
        try:
            r = requests.get(prod_url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                return None
            html = r.text
            title = None; price = None; image = None; category = ""

            title_match = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
            if title_match:
                title = unescape(title_match.group(1).strip())
            if not title:
                title_match = re.search(r'<title>([^<|]+)', html)
                if title_match:
                    title = unescape(title_match.group(1).strip())

            price_match = re.search(r'"price":\s*(\d+\.?\d*)', html)
            if price_match:
                price = str(price_match.group(1))
            else:
                price_match = re.search(r'\$(\d+\.\d{2})', html)
                if price_match:
                    price = price_match.group(1)

            img_match = re.search(
                r'(?:src|data-src)="(https://cdn11\.bigcommerce\.com/[^"]+/products/[^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"', html
            )
            if img_match:
                image = img_match.group(1)

            for ld_text in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
                try:
                    ld = json.loads(ld_text)
                    items = []
                    if isinstance(ld, dict) and ld.get("@type") == "Product":
                        items = [ld]
                    elif isinstance(ld, dict) and ld.get("@graph"):
                        items = [i for i in ld["@graph"] if isinstance(i, dict) and i.get("@type") == "Product"]
                    elif isinstance(ld, list):
                        items = [i for i in ld if isinstance(i, dict) and i.get("@type") == "Product"]
                    for item in items:
                        if not title:
                            title = unescape(item.get("name", ""))
                        if not image:
                            img = item.get("image")
                            if isinstance(img, list): img = img[0] if img else None
                            if isinstance(img, dict): img = img.get("url")
                            image = img
                        if not price:
                            offers = item.get("offers", {})
                            if isinstance(offers, list): offers = offers[0] if offers else {}
                            price = str(offers.get("price", "")) if offers.get("price") else None
                        category = item.get("category", "") or ""
                except:
                    continue

            if not title:
                return None
            slug = prod_url.rstrip("/").split("/")[-1]
            return {
                "title": title, "handle": slug, "price": price, "available": True,
                "image": image, "url": prod_url, "product_type": category,
                "vendor": "King Arthur Baking Company", "tags": [],
                "store_name": "King Arthur Baking Company",
            }
        except:
            return None

    log(f"  Fetching details for {len(unique_urls)} products...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_ka_product, u): u for u in unique_urls}
        done = 0
        for f in as_completed(futures):
            result = f.result()
            if result:
                products.append(result)
            done += 1
            if done % 30 == 0:
                log(f"    {done}/{len(unique_urls)} fetched ({len(products)} products)...")
            time.sleep(0.15)

    log(f"  TOTAL: {len(products)} King Arthur products")
    return products


# ---------------------------------------------------------------------------
# 3. CARILOHA (BigCommerce) - sitemap-based
# ---------------------------------------------------------------------------
def scrape_cariloha():
    """Scrape Cariloha products from sitemap + individual pages."""
    log("\n=== CARILOHA (BigCommerce) ===")
    base = "https://www.cariloha.com"
    products = []
    product_urls = []

    for page in range(1, 5):
        try:
            r = requests.get(f"{base}/xmlsitemap.php?type=products&page={page}",
                             timeout=15, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            urls = re.findall(r'<loc>([^<]+)</loc>', r.text)
            if not urls:
                break
            product_urls.extend(urls)
            log(f"  Sitemap page {page}: {len(urls)} URLs")
            if len(urls) < 50:
                break
        except Exception as e:
            log(f"  Sitemap page {page} error: {e}")
            break

    log(f"  Found {len(product_urls)} product URLs in sitemap")

    skip_patterns = ['/rma/', '/donation/', '/charity-donation/', '/exclusive/',
                     '/bamboo-nation-rewards', '/white-glove-product/', '/sleep-free-shipping/']
    product_urls = [u for u in product_urls if not any(s in u for s in skip_patterns)]
    log(f"  After filtering: {len(product_urls)} product URLs")

    def fetch_cariloha_product(prod_url):
        try:
            r = requests.get(prod_url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                return None
            html = r.text
            title = None; price = None; image = None

            title_match = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
            if title_match:
                title = unescape(title_match.group(1).strip())

            price_match = re.search(r'"price":\s*{\s*"without_tax":\s*{\s*"formatted":\s*"\$([^"]+)"', html)
            if price_match:
                price = price_match.group(1).replace(",", "")
            else:
                price_match = re.search(r'data-product-price="(\d+\.?\d*)"', html)
                if price_match:
                    price = str(price_match.group(1))
                else:
                    price_match = re.search(r'"price":\s*(\d+\.?\d+)', html)
                    if price_match:
                        price = str(price_match.group(1))
                    else:
                        price_match = re.search(r'\$(\d+(?:\.\d{2})?)', html)
                        if price_match:
                            price = price_match.group(1)

            img_match = re.search(
                r'(?:src|data-src)="(https://cdn11\.bigcommerce\.com/[^"]+/products/[^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"', html
            )
            if img_match:
                image = img_match.group(1)
            else:
                img_match = re.search(r'(?:src|content)="(https://i\.shgcdn\.com/[^"]+)"', html)
                if img_match:
                    image = img_match.group(1)

            available = True
            if re.search(r'out.of.stock|sold.out|unavailable', html, re.I):
                available = False

            if not title:
                return None
            slug = prod_url.rstrip("/").split("/")[-1]
            return {
                "title": title, "handle": slug, "price": price, "available": available,
                "image": image, "url": prod_url, "product_type": "", "vendor": "Cariloha",
                "tags": [], "store_name": "Cariloha",
            }
        except:
            return None

    log(f"  Fetching details for {len(product_urls)} products...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_cariloha_product, u): u for u in product_urls}
        done = 0
        for f in as_completed(futures):
            result = f.result()
            if result:
                products.append(result)
            done += 1
            if done % 30 == 0:
                log(f"    {done}/{len(product_urls)} fetched ({len(products)} products)...")
            time.sleep(0.15)

    log(f"  TOTAL: {len(products)} Cariloha products")
    return products


# ---------------------------------------------------------------------------
# 4. LAKE CHAMPLAIN CHOCOLATES (BigCommerce) - sitemap-based
# ---------------------------------------------------------------------------
def scrape_lake_champlain():
    """Scrape Lake Champlain Chocolates from sitemap + individual pages."""
    log("\n=== LAKE CHAMPLAIN CHOCOLATES (BigCommerce) ===")
    base = "https://www.lakechamplainchocolates.com"
    products = []
    product_urls = []

    for page in range(1, 5):
        try:
            r = requests.get(f"{base}/xmlsitemap.php?type=products&page={page}",
                             timeout=15, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            urls = re.findall(r'<loc>([^<]+)</loc>', r.text)
            if not urls:
                break
            product_urls.extend(urls)
            log(f"  Sitemap page {page}: {len(urls)} URLs")
            if len(urls) < 50:
                break
        except Exception as e:
            log(f"  Sitemap page {page} error: {e}")
            break

    log(f"  Found {len(product_urls)} product URLs in sitemap")

    skip_patterns = ['-recipe', 'gift-card', 'temper-chocolate-table',
                     'chocolate-fanatics-club']
    product_urls_filtered = []
    for u in product_urls:
        slug = u.rstrip("/").split("/")[-1]
        if not any(s in slug for s in skip_patterns):
            product_urls_filtered.append(u)
    log(f"  After filtering recipes/non-products: {len(product_urls_filtered)} URLs")

    def fetch_lcc_product(prod_url):
        try:
            r = requests.get(prod_url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                return None
            html = r.text
            title = None; price = None; image = None

            title_match = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
            if title_match:
                title = unescape(title_match.group(1).strip())

            price_match = re.search(r'"price":\s*{\s*"without_tax":\s*{\s*"formatted":\s*"\$([^"]+)"', html)
            if price_match:
                price = price_match.group(1).replace(",", "")
            else:
                price_match = re.search(r'data-product-price="(\d+\.?\d*)"', html)
                if price_match:
                    price = str(price_match.group(1))
                else:
                    price_match = re.search(r'"price":\s*(\d+\.?\d+)', html)
                    if price_match:
                        price = str(price_match.group(1))
                    else:
                        price_match = re.search(r'\$(\d+\.\d{2})', html)
                        if price_match:
                            price = price_match.group(1)

            img_match = re.search(
                r'(?:src|data-src)="(https://cdn11\.bigcommerce\.com/[^"]+/products/[^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"', html
            )
            if img_match:
                image = img_match.group(1)

            available = True
            if re.search(r'out.of.stock|sold.out|currently.unavailable', html, re.I):
                available = False

            if not title:
                return None
            if not price and re.search(r'recipe|instructions|ingredients.*directions', html, re.I):
                return None

            slug = prod_url.rstrip("/").split("/")[-1]
            return {
                "title": title, "handle": slug, "price": price, "available": available,
                "image": image, "url": prod_url, "product_type": "Chocolates",
                "vendor": "Lake Champlain Chocolates", "tags": [],
                "store_name": "Lake Champlain Chocolates",
            }
        except:
            return None

    log(f"  Fetching details for {len(product_urls_filtered)} products...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_lcc_product, u): u for u in product_urls_filtered}
        done = 0
        for f in as_completed(futures):
            result = f.result()
            if result:
                products.append(result)
            done += 1
            if done % 30 == 0:
                log(f"    {done}/{len(product_urls_filtered)} fetched ({len(products)} products)...")
            time.sleep(0.15)

    log(f"  TOTAL: {len(products)} Lake Champlain products")
    return products


# ---------------------------------------------------------------------------
# 5. PATAGONIA - headless/custom, often blocks scrapers
# ---------------------------------------------------------------------------
def scrape_patagonia():
    """Attempt to scrape Patagonia. Site often blocks automated access."""
    log("\n=== PATAGONIA ===")
    base = "https://www.patagonia.com"

    try:
        r = requests.get(base, timeout=15, headers=HEADERS, verify=False)
        if "hands full" in r.text or "Sit tight" in r.text or r.status_code != 200:
            log("  Site is in maintenance/queue mode. Cannot scrape.")
            log("  Patagonia uses a headless/custom platform that blocks automated access.")
            return []
    except Exception as e:
        log(f"  Cannot reach site: {e}")
        return []

    products = []
    try:
        r = requests.get(f"{base}/sitemap_index.xml", timeout=10, headers=HEADERS, verify=False)
        if r.status_code == 200 and '<loc>' in r.text:
            sitemaps = re.findall(r'<loc>([^<]+)</loc>', r.text)
            product_sitemaps = [s for s in sitemaps if 'product' in s.lower()]
            log(f"  Found {len(product_sitemaps)} product sitemaps")
        else:
            log("  No sitemap available")
    except:
        log("  Sitemap fetch failed")

    log(f"  TOTAL: {len(products)} Patagonia products (site blocked)")
    return products


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    all_results = {}

    torani_products = scrape_torani()
    all_results["torani"] = torani_products
    with open(f"{BASE_DIR}/products_torani.json", "w") as f:
        json.dump(torani_products, f, indent=2)
    log(f"Saved {len(torani_products)} Torani products")

    king_arthur_products = scrape_king_arthur()
    all_results["king_arthur"] = king_arthur_products
    with open(f"{BASE_DIR}/products_king_arthur.json", "w") as f:
        json.dump(king_arthur_products, f, indent=2)
    log(f"Saved {len(king_arthur_products)} King Arthur products")

    cariloha_products = scrape_cariloha()
    all_results["cariloha"] = cariloha_products
    with open(f"{BASE_DIR}/products_cariloha.json", "w") as f:
        json.dump(cariloha_products, f, indent=2)
    log(f"Saved {len(cariloha_products)} Cariloha products")

    lake_champlain_products = scrape_lake_champlain()
    all_results["lake_champlain"] = lake_champlain_products
    with open(f"{BASE_DIR}/products_lake_champlain.json", "w") as f:
        json.dump(lake_champlain_products, f, indent=2)
    log(f"Saved {len(lake_champlain_products)} Lake Champlain products")

    patagonia_products = scrape_patagonia()
    all_results["patagonia"] = patagonia_products
    if patagonia_products:
        with open(f"{BASE_DIR}/products_patagonia.json", "w") as f:
            json.dump(patagonia_products, f, indent=2)
        log(f"Saved {len(patagonia_products)} Patagonia products")

    log("\n" + "=" * 60)
    log("FINAL RESULTS")
    log("=" * 60)
    for store, prods in all_results.items():
        log(f"  {store}: {len(prods)} products")
    total = sum(len(p) for p in all_results.values())
    log(f"  TOTAL: {total} products")
