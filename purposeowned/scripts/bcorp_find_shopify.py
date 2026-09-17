"""Test all 584 B Corp websites for Shopify /products.json endpoint."""
import json
import requests
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

def check_shopify(url):
    """Check if a URL is a Shopify store by hitting /products.json."""
    try:
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        resp = requests.get(
            f"{base}/products.json?limit=1",
            timeout=8,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0"},
            verify=False,
        )
        if resp.status_code == 200:
            ct = resp.headers.get("content-type", "")
            if "json" in ct:
                data = resp.json()
                if "products" in data:
                    count = len(data["products"])
                    return True, count, base
        return False, 0, base
    except:
        return False, 0, url

with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    companies = json.load(f)

targets = [(i, c) for i, c in enumerate(companies) if c.get("website")]
log(f"Testing {len(targets)} URLs for Shopify /products.json...")

shopify_stores = []

with ThreadPoolExecutor(max_workers=25) as executor:
    futures = {executor.submit(check_shopify, c["website"]): (i, c) for i, c in targets}
    done = 0
    for future in as_completed(futures):
        i, c = futures[future]
        is_shopify, count, base = future.result()
        if is_shopify:
            shopify_stores.append((c["name"], c["slug"], c["website"], c.get("industry", "")))
            companies[i]["ecommerce"] = True
            companies[i]["ecommerce_platform"] = "Shopify"
        done += 1
        if done % 100 == 0:
            log(f"  {done}/{len(targets)} checked — {len(shopify_stores)} Shopify found")

log(f"\n=== SHOPIFY STORES FOUND: {len(shopify_stores)} ===\n")
for name, slug, url, industry in sorted(shopify_stores, key=lambda x: x[3]):
    log(f"  {name} ({industry}) — {url}")

# Save updated data
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json', 'w') as f:
    json.dump(companies, f, indent=2)

# Also save just the Shopify list for easy scraping
shopify_list = [{"name": c["name"], "slug": c["slug"], "website": c["website"],
                 "industry": c.get("industry", ""), "hqCity": c.get("hqCity", ""),
                 "hqProvince": c.get("hqProvince", "")}
                for c in companies if c.get("ecommerce_platform") == "Shopify"]
with open('/Applications/worker-owned/purposeowned/bcorp_shopify_stores.json', 'w') as f:
    json.dump(shopify_list, f, indent=2)
log(f"\nSaved {len(shopify_list)} Shopify stores to purposeowned/bcorp_shopify_stores.json")
