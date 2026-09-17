"""Triage B Corp websites to identify which have real e-commerce stores."""
import json
import re
import time
import requests
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

ECOMMERCE_SIGNALS = {
    # Platform indicators (strong)
    "shopify": 3, "myshopify.com": 3, "cdn.shopify.com": 3,
    "bigcommerce": 3, "woocommerce": 3, "wp-content/plugins/woocommerce": 3,
    "squarespace-commerce": 2, "swell.store": 3,
    "magento": 3, "mage-": 2,
    # Cart/checkout indicators (strong)
    "add-to-cart": 3, "add_to_cart": 3, "addtocart": 3,
    "cart-icon": 2, "cart-count": 2, "shopping-cart": 2, "minicart": 2,
    "/cart": 2, "/checkout": 3,
    # Shop page indicators (medium)
    "/shop": 2, "/store": 2, "/products": 2, "/collections": 2,
    "/product/": 2, "/product-category": 2,
    # Price indicators (medium)
    "product-price": 2, "price-amount": 2,
    # Buy button indicators (medium)
    "buy-now": 2, "buy now": 1, "shop now": 1, "add to bag": 2,
}

WHOLESALE_SIGNALS = [
    "wholesale only", "wholesale-only", "b2b only", "trade only",
    "retailers only", "not available for individual purchase",
    "find a retailer", "store locator", "where to buy",
    "find us in stores", "available at",
]

def check_ecommerce(url, timeout=10):
    """Check if a URL has e-commerce by fetching the homepage and /shop page."""
    result = {
        "url": url,
        "has_ecommerce": False,
        "score": 0,
        "platform": None,
        "signals": [],
        "wholesale_only": False,
        "status": None,
        "error": None,
    }

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
        }

        # Check homepage
        resp = requests.get(url, timeout=timeout, allow_redirects=True,
                          headers=headers, verify=False)
        result["status"] = resp.status_code

        if resp.status_code >= 400:
            result["error"] = f"HTTP {resp.status_code}"
            return result

        html = resp.text.lower()

        # Check for e-commerce signals
        for signal, weight in ECOMMERCE_SIGNALS.items():
            if signal in html:
                result["score"] += weight
                result["signals"].append(signal)

        # Detect platform
        if "cdn.shopify.com" in html or "myshopify.com" in html or "shopify" in html:
            result["platform"] = "Shopify"
        elif "woocommerce" in html or "wp-content/plugins/woocommerce" in html:
            result["platform"] = "WooCommerce"
        elif "bigcommerce" in html:
            result["platform"] = "BigCommerce"
        elif "magento" in html or "mage-" in html:
            result["platform"] = "Magento"
        elif "squarespace-commerce" in html:
            result["platform"] = "Squarespace"

        # Check for wholesale-only signals
        for signal in WHOLESALE_SIGNALS:
            if signal in html:
                result["wholesale_only"] = True
                result["signals"].append(f"wholesale:{signal}")
                break

        # Also try /shop or /collections page if score is low
        if result["score"] < 3:
            for path in ["/shop", "/collections", "/products", "/store"]:
                try:
                    shop_url = url.rstrip("/") + path
                    r2 = requests.get(shop_url, timeout=6, allow_redirects=True,
                                    headers=headers, verify=False)
                    if r2.status_code == 200 and len(r2.text) > 1000:
                        html2 = r2.text.lower()
                        for signal, weight in ECOMMERCE_SIGNALS.items():
                            if signal in html2 and signal not in [s for s in result["signals"]]:
                                result["score"] += weight
                                result["signals"].append(f"{path}:{signal}")
                        if "product" in html2 and ("price" in html2 or "$" in html2):
                            result["score"] += 2
                            result["signals"].append(f"{path}:product+price")
                        break  # found a working shop page
                except:
                    continue

        result["has_ecommerce"] = result["score"] >= 3

    except requests.exceptions.Timeout:
        result["error"] = "timeout"
    except requests.exceptions.ConnectionError as e:
        result["error"] = "connection_error"
    except Exception as e:
        result["error"] = str(e)[:80]

    return result

# Load companies
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    companies = json.load(f)

companies_with_urls = [(i, c) for i, c in enumerate(companies) if c.get("website")]
log(f"Triaging {len(companies_with_urls)} websites for e-commerce...")

results = {}
start = time.time()

with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {}
    for idx, c in companies_with_urls:
        future = executor.submit(check_ecommerce, c["website"])
        futures[future] = (idx, c)

    done = 0
    for future in as_completed(futures):
        idx, c = futures[future]
        result = future.result()
        slug = c.get("slug", "")
        results[slug] = result
        companies[idx]["ecommerce"] = result["has_ecommerce"]
        companies[idx]["ecommerce_platform"] = result.get("platform")
        companies[idx]["ecommerce_score"] = result["score"]
        companies[idx]["wholesale_only"] = result.get("wholesale_only", False)

        done += 1
        if done % 50 == 0:
            ecom = len([r for r in results.values() if r["has_ecommerce"]])
            elapsed = time.time() - start
            rate = done / elapsed * 60
            remaining = (len(companies_with_urls) - done) / max(rate/60, 0.1) / 60
            log(f"  {done}/{len(companies_with_urls)} — {ecom} e-commerce — {rate:.0f}/min — ~{remaining:.0f}min left")

# Summary
ecom = [c for c in companies if c.get("ecommerce")]
wholesale = [c for c in companies if c.get("wholesale_only")]
no_ecom = [c for c in companies if c.get("website") and not c.get("ecommerce")]

log(f"\n=== RESULTS ===")
log(f"E-commerce sites: {len(ecom)}")
log(f"Wholesale-only flagged: {len(wholesale)}")
log(f"No e-commerce detected: {len(no_ecom)}")
log(f"No website: {len([c for c in companies if not c.get('website')])}")

# Platform breakdown
platforms = {}
for c in ecom:
    p = c.get("ecommerce_platform", "Unknown")
    platforms[p] = platforms.get(p, 0) + 1
log(f"\nPlatforms:")
for p, count in sorted(platforms.items(), key=lambda x: -x[1]):
    log(f"  {p or 'Unknown'}: {count}")

# Industry breakdown of e-commerce sites
industries = {}
for c in ecom:
    ind = c.get("industry", "?")
    industries[ind] = industries.get(ind, 0) + 1
log(f"\nE-commerce by industry:")
for ind, count in sorted(industries.items(), key=lambda x: -x[1]):
    log(f"  {ind}: {count}")

# Save
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json', 'w') as f:
    json.dump(companies, f, indent=2)

# Update CSV
import csv
from datetime import datetime
with open('/Applications/worker-owned/purposeowned/bcorp_us_ecommerce.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['name','slug','industry','sector','hq_city','hq_state','size','score',
                     'certified_date','website','has_ecommerce','platform','wholesale_only','bcorp_profile_url'])
    for c in sorted(companies, key=lambda x: (not x.get('ecommerce',False), x.get('industry',''), x.get('name',''))):
        ts = c.get('initialCertificationDateTimestamp')
        cert_date = ''
        if ts:
            try: cert_date = datetime.fromtimestamp(int(ts)/1000).strftime('%Y-%m-%d')
            except: pass
        slug = c.get('slug','')
        writer.writerow([
            c.get('name',''), slug, c.get('industry',''), c.get('sector',''),
            c.get('hqCity',''), c.get('hqProvince',''),
            c.get('size',''), c.get('latestVerifiedScore',''), cert_date,
            c.get('website',''), c.get('ecommerce',''), c.get('ecommerce_platform',''),
            c.get('wholesale_only',''),
            f'https://www.bcorporation.net/en-us/find-a-b-corp/company/{slug}/' if slug else '',
        ])

log(f"\nSaved updated data.")

# Show top e-commerce sites
log(f"\nSample e-commerce sites (highest score):")
for c in sorted(ecom, key=lambda x: -x.get('ecommerce_score', 0))[:30]:
    log(f"  {c['name']} ({c.get('ecommerce_platform','?')}) — {c['website']} — score:{c.get('ecommerce_score',0)}")
