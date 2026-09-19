#!/usr/bin/env python3
"""Scrape Patagonia products via their AU Shopify store."""

import json
import ssl
import time
import urllib.request

ssl._create_default_https_context = ssl._create_unverified_context

BASE = "https://www.patagonia.com.au/products.json"
AU_BASE = "https://www.patagonia.com.au/products"
LIMIT = 250
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

all_products = []
page = 1

while True:
    url = f"{BASE}?limit={LIMIT}&page={page}"
    print(f"Page {page}: {url}")

    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())

    products = data.get("products", [])
    if not products:
        break

    for p in products:
        # Get first available variant
        variants = p.get("variants", [])
        price = None
        available = False
        for v in variants:
            if v.get("available"):
                available = True
                price = float(v["price"]) if v.get("price") else None
                break
        if not available and variants:
            price = float(variants[0]["price"]) if variants[0].get("price") else None

        # Get first image
        images = p.get("images", [])
        image = images[0]["src"] if images else ""

        # Build US URL from handle
        handle = p.get("handle", "")
        au_url = f"https://www.patagonia.com.au/products/{handle}"

        all_products.append({
            "title": p.get("title", ""),
            "handle": handle,
            "price": price,
            "available": available,
            "image": image,
            "url": au_url,
            "product_type": p.get("product_type", ""),
            "vendor": "Patagonia",
            "tags": p.get("tags", []),
            "store_name": "Patagonia",
        })

    print(f"  Got {len(products)} products (total: {len(all_products)})")

    if len(products) < LIMIT:
        break

    page += 1
    time.sleep(1)

# Filter out gift cards, donations, etc.
filtered = [p for p in all_products if p["price"] and p["price"] > 0
            and "gift card" not in p["title"].lower()
            and "donation" not in p["title"].lower()]

print(f"\nTotal: {len(all_products)}, after filtering: {len(filtered)}")
print(f"With images: {sum(1 for p in filtered if p['image'])}")
print(f"Available: {sum(1 for p in filtered if p['available'])}")

out = "/Applications/worker-owned/purposeowned/products_patagonia.json"
with open(out, "w") as f:
    json.dump(filtered, f, indent=2)
print(f"Saved to {out}")
