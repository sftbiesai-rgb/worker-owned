"""
Pull benefit corporation directory, find websites, detect e-commerce.
Stats tracked throughout for reporting to Mark.
"""
import csv
import io
import json
import re
import time
import requests
import urllib3
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

urllib3.disable_warnings()

def log(msg):
    print(msg, flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# Step 1: Pull the CSV
log("=== STEP 1: Pull benefit corporation directory ===")
url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQjg4KfxxFbXyDlQyJQwqQvQ-dIBKJOow0tnbZ40Yqn-qcZpkClyMU5Sb8vdSfXBQ8e4hTf46oOSnF/pub?gid=0&single=true&output=csv"
r = requests.get(url, timeout=15, verify=False)
reader = csv.DictReader(io.StringIO(r.text))
rows = list(reader)
log(f"Total benefit corporations: {len(rows)}")

states = Counter(row.get("State", "") for row in rows)
good_standing = len([r for r in rows if r.get("Standing", "").strip().lower() == "good standing"])
log(f"In good standing: {good_standing}")
log(f"States represented: {len(states)}")

# Filter to good standing only
companies = []
for row in rows:
    if row.get("Standing", "").strip().lower() != "good standing":
        continue
    name = row.get("Company Name", "").strip()
    state = row.get("State", "").strip()
    city_raw = row.get("City", "").strip()
    website = row.get("Website", "").strip()

    # Clean city (often has state abbreviation)
    city = city_raw.split(",")[0].strip() if city_raw and city_raw != "Not Provided" else ""

    companies.append({
        "name": name,
        "state": state,
        "city": city,
        "website": website,
        "source": "benefit-corp-directory",
        "standing": "Good Standing",
    })

log(f"Good standing companies: {len(companies)}")

# Step 2: Find websites via domain guessing
log(f"\n=== STEP 2: Find websites ===")

# Already have websites from CSV
with_website = len([c for c in companies if c["website"]])
log(f"Already have website: {with_website}")

def guess_domains(name):
    """Generate candidate domains from company name."""
    # Clean name
    clean = re.sub(r'\b(LLC|Inc\.?|Corp\.?|Co\.?|PBC|SPC|L3C|Ltd\.?|Limited|Company|Corporation|International|Holdings|Group|Enterprises|Partners|Consulting|Solutions|Services|Technologies|Brands|Worldwide|Global|USA|US|America|North America)\b', '', name, flags=re.IGNORECASE)
    clean = re.sub(r'[,.\'"!@#$%^&*()]+', ' ', clean).strip()
    clean = re.sub(r'\s+', ' ', clean)
    words = clean.lower().split()

    if not words:
        return []

    candidates = []
    slug = ''.join(words)
    hyphenated = '-'.join(words)

    for suffix in ['.com', '.co', '.org', '.io', '.us']:
        candidates.append(f"https://{slug}{suffix}")
        candidates.append(f"https://www.{slug}{suffix}")
        if len(words) > 1:
            candidates.append(f"https://{hyphenated}{suffix}")
            candidates.append(f"https://www.{hyphenated}{suffix}")
            # First word only
            candidates.append(f"https://{words[0]}{suffix}")
            candidates.append(f"https://www.{words[0]}{suffix}")

    return list(dict.fromkeys(candidates))[:12]  # max 12 candidates

def check_url(url, timeout=5):
    try:
        resp = requests.head(url, timeout=timeout, allow_redirects=True,
                           headers=HEADERS, verify=False)
        return resp.status_code < 400 or resp.status_code == 403
    except:
        return False

def find_website(company):
    """Try to find a website for a company."""
    name = company["name"]
    candidates = guess_domains(name)
    for url in candidates:
        if check_url(url):
            return url
    return None

# Only search for companies without websites
no_website = [c for c in companies if not c["website"]]
log(f"Searching for websites for {len(no_website)} companies...")

# This is a LOT of companies. Let's be smart:
# Skip generic/shell company names (common in Delaware)
SKIP_PATTERNS = [
    r'^\d+',  # starts with number
    r'holdings?\b',
    r'capital\b',
    r'ventures?\b',
    r'partners?\b',
    r'investments?\b',
    r'properties\b',
    r'realty\b',
    r'real estate\b',
    r'management\b',
    r'consulting\b',
    r'advisors?\b',
    r'financial\b',
    r'insurance\b',
    r'legal\b',
    r'law\b',
    r'accounting\b',
    r'analytics\b',
]

def is_consumer_candidate(name):
    """Quick filter: is this likely a consumer-facing business?"""
    lower = name.lower()
    for pat in SKIP_PATTERNS:
        if re.search(pat, lower):
            return False
    # Skip very short names (likely abbreviations/shells)
    clean = re.sub(r'\b(LLC|Inc|Corp|Co|PBC|SPC|L3C)\b', '', name, flags=re.IGNORECASE).strip()
    if len(clean) < 4:
        return False
    return True

consumer_candidates = [c for c in no_website if is_consumer_candidate(c["name"])]
log(f"Consumer-facing candidates (after filtering): {len(consumer_candidates)}")

# Search in batches with threading
found = 0
checked = 0

with ThreadPoolExecutor(max_workers=25) as executor:
    futures = {executor.submit(find_website, c): c for c in consumer_candidates}
    for future in as_completed(futures):
        c = futures[future]
        url = future.result()
        if url:
            c["website"] = url
            found += 1
        checked += 1
        if checked % 200 == 0:
            log(f"  {checked}/{len(consumer_candidates)} checked — {found} websites found")

log(f"\nWebsite search complete: {found} new websites found")
total_with_website = len([c for c in companies if c["website"]])
log(f"Total with website: {total_with_website}/{len(companies)}")

# Step 3: Check for e-commerce
log(f"\n=== STEP 3: Detect e-commerce ===")

ECOMMERCE_SIGNALS = {
    "shopify": 3, "myshopify.com": 3, "cdn.shopify.com": 3,
    "bigcommerce": 3, "woocommerce": 3, "wp-content/plugins/woocommerce": 3,
    "squarespace-commerce": 2,
    "add-to-cart": 3, "add_to_cart": 3,
    "cart-icon": 2, "shopping-cart": 2, "minicart": 2,
    "/cart": 2, "/checkout": 3,
    "/shop": 2, "/store": 2, "/products": 2, "/collections": 2,
    "product-price": 2, "price-amount": 2,
    "buy-now": 2, "shop now": 1,
}

def check_ecommerce(url, timeout=8):
    try:
        resp = requests.get(url, timeout=timeout, allow_redirects=True,
                          headers=HEADERS, verify=False)
        if resp.status_code >= 400:
            return False, None, 0
        html = resp.text.lower()
        score = 0
        platform = None
        for signal, weight in ECOMMERCE_SIGNALS.items():
            if signal in html:
                score += weight
        if "cdn.shopify.com" in html or "myshopify.com" in html:
            platform = "Shopify"
        elif "woocommerce" in html:
            platform = "WooCommerce"
        elif "bigcommerce" in html:
            platform = "BigCommerce"
        elif "squarespace-commerce" in html:
            platform = "Squarespace"
        return score >= 3, platform, score
    except:
        return False, None, 0

sites_to_check = [c for c in companies if c["website"]]
log(f"Checking {len(sites_to_check)} websites for e-commerce...")

ecom_count = 0
checked = 0

with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(check_ecommerce, c["website"]): c for c in sites_to_check}
    for future in as_completed(futures):
        c = futures[future]
        has_ecom, platform, score = future.result()
        c["ecommerce"] = has_ecom
        c["ecommerce_platform"] = platform
        c["ecommerce_score"] = score
        if has_ecom:
            ecom_count += 1
        checked += 1
        if checked % 100 == 0:
            log(f"  {checked}/{len(sites_to_check)} — {ecom_count} e-commerce found")

log(f"\nE-commerce detection complete: {ecom_count} stores found")

# Step 4: Save and report
log(f"\n=== FINAL STATS (for Mark) ===")
log(f"")
log(f"Benefit Corporation Directory:")
log(f"  Total registered: {len(rows)}")
log(f"  Good standing: {len(companies)}")
log(f"  Website found: {total_with_website} ({total_with_website/len(companies)*100:.1f}%)")
log(f"  E-commerce detected: {ecom_count}")
log(f"")

# Platform breakdown
platforms = Counter(c.get("ecommerce_platform") or "Unknown" for c in companies if c.get("ecommerce"))
if platforms:
    log(f"  E-commerce platforms:")
    for p, count in platforms.most_common():
        log(f"    {p}: {count}")

# State breakdown of e-commerce
ecom_states = Counter(c["state"] for c in companies if c.get("ecommerce"))
if ecom_states:
    log(f"\n  E-commerce by state (top 10):")
    for s, count in ecom_states.most_common(10):
        log(f"    {s}: {count}")

# Overlap with B Corps
log(f"\n  Note: Some may overlap with B Corp directory (not yet deduped)")

# Save
with open("/Applications/worker-owned/purposeowned/benefit_corps.json", "w") as f:
    json.dump(companies, f, indent=2)

# Save just the e-commerce ones
ecom_companies = [c for c in companies if c.get("ecommerce")]
with open("/Applications/worker-owned/purposeowned/benefit_corps_ecommerce.json", "w") as f:
    json.dump(ecom_companies, f, indent=2)

log(f"\nSaved {len(companies)} companies to purposeowned/benefit_corps.json")
log(f"Saved {len(ecom_companies)} e-commerce companies to purposeowned/benefit_corps_ecommerce.json")
