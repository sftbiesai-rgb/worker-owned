"""Scrape BigCommerce stores for products."""
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

STORES = [
    # B Corps
    {"name": "Cariloha", "website": "https://www.cariloha.com/"},
    {"name": "Eco-Products, PBC", "website": "https://ecoproducts.com/"},
    {"name": "ExquisiteCrystals.com LLC", "website": "https://www.exquisitecrystals.com"},
    {"name": "Good Start Packaging", "website": "https://www.goodstartpackaging.com/"},
    {"name": "Inesscents Aromatic Botanicals", "website": "https://inesscents.com/"},
    {"name": "Revolution Foods", "website": "https://www.revolution.com/"},
    {"name": "Roads Rivers and Trails", "website": "https://roadsriversandtrails.com/"},
    # Benefit Corps
    {"name": "MILEHIGHSOLUTIONS", "website": "https://milehighsolutions.com"},
    {"name": "Lake Champlain Chocolates", "website": "https://lakechamplainchocolates.com"},
    {"name": "King Arthur Baking Company", "website": "https://kingarthurbaking.com"},
]

def scrape_bigcommerce(base_url, store_name):
    """Try multiple methods to scrape BigCommerce products."""
    base = base_url.rstrip("/")
    products = []

    # Method 1: Sitemap-based scraping
    product_urls = []
    try:
        r = requests.get(f"{base}/sitemap.xml", timeout=10, headers=HEADERS, verify=False)
        if r.status_code == 200:
            # Find product sitemap or product URLs directly
            sub_urls = re.findall(r'<loc>([^<]+)</loc>', r.text)
            for sm_url in sub_urls:
                if 'product' in sm_url.lower():
                    try:
                        r2 = requests.get(sm_url, timeout=10, headers=HEADERS, verify=False)
                        if r2.status_code == 200:
                            product_urls.extend(re.findall(r'<loc>([^<]+)</loc>', r2.text))
                    except:
                        continue
                elif sm_url.endswith('.xml'):
                    continue
                else:
                    # Could be a direct product URL
                    pass
    except:
        pass

    # Method 2: GraphQL storefront API
    # BigCommerce has a storefront GraphQL - need store hash from page source
    try:
        r = requests.get(base, timeout=10, headers=HEADERS, verify=False)
        if r.status_code == 200:
            # Look for store hash or API token in page source
            html = r.text
            # Find product links from navigation/page
            links = re.findall(r'href="([^"]*(?:/products?/|/shop/|/all-products)[^"]*)"', html, re.I)
            if not links:
                links = re.findall(r'href="(/[^"]+)"', html)
                links = [l for l in links if any(x in l.lower() for x in ['/shop', '/product', '/store', '/all'])]
    except:
        pass

    # Method 3: Try common category/shop pages and parse product cards
    for path in ["/products/", "/shop-all/", "/all/", "/shop/"]:
        try:
            page = 1
            while page <= 10:
                url = f"{base}{path}" if page == 1 else f"{base}{path}?page={page}"
                r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
                if r.status_code != 200:
                    break
                html = r.text

                # Find product cards with structured data
                ld_jsons = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
                for ld_text in ld_jsons:
                    try:
                        ld = json.loads(ld_text)
                        items = []
                        if isinstance(ld, dict) and ld.get("@type") == "ItemList":
                            items = ld.get("itemListElement", [])
                        elif isinstance(ld, dict) and ld.get("@graph"):
                            items = [i for i in ld["@graph"] if i.get("@type") == "Product"]
                        elif isinstance(ld, dict) and ld.get("@type") == "Product":
                            items = [ld]
                        elif isinstance(ld, list):
                            items = [i for i in ld if isinstance(i, dict) and i.get("@type") == "Product"]

                        for item in items:
                            prod = item.get("item", item)
                            if prod.get("@type") != "Product" and not prod.get("name"):
                                continue
                            offers = prod.get("offers", {})
                            if isinstance(offers, list):
                                offers = offers[0] if offers else {}
                            price = offers.get("price")
                            image = prod.get("image")
                            if isinstance(image, list):
                                image = image[0] if image else None
                            if isinstance(image, dict):
                                image = image.get("url")

                            prod_url = prod.get("url", "")
                            if prod_url and not prod_url.startswith("http"):
                                prod_url = f"{base}{prod_url}"

                            title = prod.get("name", "")
                            if title and not any(p["title"] == title for p in products):
                                products.append({
                                    "title": unescape(title),
                                    "handle": prod_url.rstrip("/").split("/")[-1] if prod_url else "",
                                    "price": str(price) if price else None,
                                    "available": "InStock" in str(offers.get("availability", "InStock")),
                                    "image": image,
                                    "url": prod_url or base,
                                    "product_type": prod.get("category", "") or "",
                                    "vendor": prod.get("brand", {}).get("name", "") if isinstance(prod.get("brand"), dict) else "",
                                    "tags": [],
                                    "store_name": store_name,
                                })
                    except:
                        continue

                # Check for pagination
                if f'page={page+1}' not in html and 'data-action="page-next"' not in html:
                    break
                page += 1
                time.sleep(0.3)

            if products:
                return products, f"ld-json({path})"
        except:
            continue

    # Method 4: Scrape individual product pages from sitemap
    if product_urls and not products:
        for purl in product_urls[:200]:  # cap at 200
            try:
                r = requests.get(purl, timeout=8, headers=HEADERS, verify=False)
                if r.status_code != 200:
                    continue
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
                            price = offers.get("price")
                            image = item.get("image")
                            if isinstance(image, list): image = image[0] if image else None
                            if isinstance(image, dict): image = image.get("url")
                            products.append({
                                "title": unescape(item.get("name", "")),
                                "handle": purl.rstrip("/").split("/")[-1],
                                "price": str(price) if price else None,
                                "available": "InStock" in str(offers.get("availability", "InStock")),
                                "image": image,
                                "url": purl,
                                "product_type": item.get("category", "") or "",
                                "vendor": item.get("brand", {}).get("name", "") if isinstance(item.get("brand"), dict) else "",
                                "tags": [],
                                "store_name": store_name,
                            })
                    except:
                        continue
                time.sleep(0.2)
            except:
                continue
        if products:
            return products, "sitemap+ld-json"

    return products, "none"


log(f"Scraping {len(STORES)} BigCommerce stores...\n")

all_products = []
for store in STORES:
    name = store["name"]
    url = store["website"]
    products, method = scrape_bigcommerce(url, name)
    all_products.extend(products)
    log(f"  {name}: {len(products)} products (via {method})")
    time.sleep(0.5)

with open("/Applications/worker-owned/purposeowned/products_bigcommerce.json", "w") as f:
    json.dump(all_products, f, indent=2)

success = len(set(p["store_name"] for p in all_products))
log(f"\n=== RESULTS ===")
log(f"Stores attempted: {len(STORES)}")
log(f"With products: {success}")
log(f"Total products: {len(all_products)}")
log(f"Saved to purposeowned/products_bigcommerce.json")
