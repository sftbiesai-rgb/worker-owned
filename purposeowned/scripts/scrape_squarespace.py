"""Scrape Squarespace stores for products."""
import json
import time
import requests
import urllib3
from html import unescape

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

STORES = [
    # B Corps
    {"name": "Another Tomorrow Inc.", "website": "https://www.anothertomorrow.com/"},
    {"name": "Granny Squibb's Organic Iced Tea", "website": "https://www.grannysquibbs.com"},
    {"name": "Ikaria Design Co.", "website": "https://www.ikariadesign.com/"},
    {"name": "Kalsoni", "website": "https://www.kalsoni.com/"},
    {"name": "Love Bottle", "website": "https://www.lovebottle.com/"},
    {"name": "Mainstem Malt", "website": "https://www.mainstemmalt.com/"},
    {"name": "Montanya Distillers LLC", "website": "https://www.montanyarum.com/"},
    {"name": "On-Line Instrument Systems, Inc. (OLIS)", "website": "https://www.olisweb.com"},
    {"name": "Portland Garment Factory", "website": "https://www.portlandgarmentfactory.com/"},
    {"name": "Rubicon Bakers", "website": "https://www.rubiconbakers.com/"},
    {"name": "Siponey", "website": "https://www.siponey.com/"},
    {"name": "Swift Printing Co.", "website": "https://www.swiftprinting.com/"},
    {"name": "Triple Bottom Brewing", "website": "https://triplebottombrewing.com/"},
    {"name": "Vertical Activewear", "website": "https://www.verticalactivewear.com/"},
    # Benefit Corps
    {"name": "BOHYPSIAN, SPC", "website": "https://bohypsian.com"},
    {"name": "Rick Emerson Jr. Agency Inc.", "website": "https://rick.com"},
    {"name": "Diesel Day Dreams, Inc.", "website": "https://dieseldaydreams.com"},
    {"name": "ACRONYCHOUS INC", "website": "https://acronychous.com"},
    {"name": "Beckys Got This", "website": "https://beckys.com"},
    {"name": "Colorandom Jewelry & Co.", "website": "https://colorandomjewelry.com"},
    {"name": "Conscious Revolution", "website": "https://consciousrevolution.com"},
    {"name": "WISE Resource Development", "website": "https://wiseresourcedevelopment.com"},
    {"name": "East Coast Avalanche Education LLC", "website": "https://eastcoastavalancheeducation.com"},
    {"name": "Coordination Design Inc", "website": "https://coordination-design.com"},
    {"name": "Grounded People Apparel (US)", "website": "https://grounded.com"},
    {"name": "Kalsada Coffee Company", "website": "https://kalsada.com"},
    {"name": "Living the Intention", "website": "https://livingtheintention.com"},
    {"name": "Mainstem Malt (benefit)", "website": "https://mainstemmalt.com"},
    {"name": "OarTheRainbow Public Benefit Corporation", "website": "https://oartherainbow.com"},
]

# Dedupe by domain
from urllib.parse import urlparse
seen_domains = set()
deduped = []
for s in STORES:
    domain = urlparse(s["website"]).netloc.lower().replace("www.", "")
    if domain not in seen_domains:
        seen_domains.add(domain)
        deduped.append(s)

def scrape_squarespace(base_url, store_name):
    """Try Squarespace commerce API endpoints."""
    base = base_url.rstrip("/")
    products = []

    # Method 1: /api/commerce/products endpoint (newer Squarespace)
    for offset in range(0, 2000, 50):
        try:
            url = f"{base}/api/commerce/products?limit=50&offset={offset}"
            r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                break
            data = r.json()
            items = data.get("products", data.get("items", []))
            if not items:
                break
            for item in items:
                variants = item.get("variants", [{}])
                price = None
                for v in variants:
                    p = v.get("priceMoney", {}).get("value") or v.get("price", {}).get("value")
                    if p:
                        # Squarespace prices are in cents
                        try:
                            price = str(float(p) / 100) if float(p) > 100 else str(p)
                        except:
                            price = str(p)
                        break

                image = None
                imgs = item.get("images", [])
                if imgs:
                    image = imgs[0].get("url") or imgs[0].get("originalUrl")

                slug = item.get("urlSlug", item.get("slug", ""))
                products.append({
                    "title": unescape(item.get("title", item.get("name", ""))),
                    "handle": slug,
                    "price": price,
                    "available": item.get("isVisible", True),
                    "image": image,
                    "url": f"{base}/{slug}" if slug else base,
                    "product_type": item.get("category", "") or "",
                    "vendor": "",
                    "tags": item.get("tags", []),
                    "store_name": store_name,
                })
            if len(items) < 50:
                break
            time.sleep(0.3)
        except:
            break

    if products:
        return products, "commerce-api"

    # Method 2: Query specific shop/store collection pages as JSON
    for path in ["/shop", "/store", "/products", "/all", "/catalogue", "/merch"]:
        try:
            url = f"{base}{path}?format=json"
            r = requests.get(url, timeout=10, headers=HEADERS, verify=False)
            if r.status_code != 200:
                continue
            data = r.json()
            items = data.get("items", [])
            if not items:
                continue
            for item in items:
                price = None
                # Try structuredContent for product data
                sc = item.get("structuredContent", {})
                variants = sc.get("variants", [])
                for v in variants:
                    pm = v.get("priceMoney", {})
                    p = pm.get("value")
                    if p:
                        try:
                            currency_dec = pm.get("currencyDecimalDigits", 2)
                            price = str(float(p) / (10 ** currency_dec))
                        except:
                            price = str(p)
                        break
                    p = v.get("price", v.get("retailPrice"))
                    if p:
                        price = str(p)
                        break

                image = None
                if item.get("assetUrl"):
                    image = item["assetUrl"]
                elif sc.get("productImage"):
                    image = sc["productImage"].get("url") or sc["productImage"].get("assetUrl")

                slug = item.get("urlId", item.get("fullUrl", ""))
                full_url = item.get("fullUrl", "")
                if full_url and not full_url.startswith("http"):
                    full_url = f"{base}/{full_url.lstrip('/')}"

                title = item.get("title", "")
                if title:
                    products.append({
                        "title": unescape(title),
                        "handle": slug,
                        "price": price,
                        "available": sc.get("isVisible", True) if sc else True,
                        "image": image,
                        "url": full_url or f"{base}/{slug}",
                        "product_type": "",
                        "vendor": "",
                        "tags": item.get("tags", []),
                        "store_name": store_name,
                    })
            if products:
                return products, f"collection-json({path})"
        except:
            continue

    return products, "none"


log(f"Scraping {len(deduped)} Squarespace stores...\n")

all_products = []
for store in deduped:
    name = store["name"]
    url = store["website"]
    products, method = scrape_squarespace(url, name)
    all_products.extend(products)
    log(f"  {name}: {len(products)} products (via {method})")
    time.sleep(0.5)

with open("/Applications/worker-owned/purposeowned/products_squarespace.json", "w") as f:
    json.dump(all_products, f, indent=2)

success = len(set(p["store_name"] for p in all_products))
log(f"\n=== RESULTS ===")
log(f"Stores attempted: {len(deduped)}")
log(f"With products: {success}")
log(f"Total products: {len(all_products)}")
log(f"Saved to purposeowned/products_squarespace.json")
