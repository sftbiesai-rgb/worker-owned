"""Fix the last 40 with correct known URLs."""
import json
import requests
from datetime import datetime
import csv

def log(msg):
    print(msg, flush=True)

def check_url(url, timeout=5):
    try:
        resp = requests.head(url, timeout=timeout, allow_redirects=True,
                           headers={"User-Agent": "Mozilla/5.0"})
        return resp.status_code < 400
    except:
        return False

FIXES = {
    "allagash-brewing-company": "https://www.allagash.com",
    "arbonne": "https://www.arbonne.com",
    "aveda-corporation": "https://www.aveda.com",
    "cartograph-wines": "https://cartographwines.com",
    "yogi-tea-us": "https://yogiproducts.com",
    "firsthand-foods": "https://firsthandfoods.com",
    "frisky-cow-farm-products": "https://friskycowfarmstead.com",
    "gibbs-m-smith-inc": "https://www.gibbs-smith.com",
    "phlur": "https://phlur.com",
    "glorybee": "https://glorybee.com",
    "ground-work-renewables-inc": "https://groundworkrenewables.com",
    "holistic-spirits-company": "https://holisticspirits.co",
    "horizon-organic": "https://www.horizonorganic.com",
    "hyggelight-llc": "https://hyggelight.com",
    "instructional-coaching-group": "https://instructionalcoaching.com",
    "just-made-foods-llc": "https://drinkjustmade.com",
    "kehe": "https://www.kehe.com",
    "lawsons-finest-liquids": "https://lawsonsfinest.com",
    "looptworks": "https://looptworks.com",
    "on-line-instrument-systems-inc-olis": "https://olisweb.com",
    "packed-with-purpose": "https://packedwithpurpose.gifts",
    "rhino-foods": "https://rhinofoods.com",
    "rockin-cat": "https://rockincatcoffee.com",
    "sachai-tea-benefit-corp": "https://sachaitea.com",
    "seed-sustainable-entrepreneurial-ecosystem-development": "https://seedbiopak.com",
    "sofine-food": "https://dressitup.com",
    "sudara-inc": "https://sudara.com",
    "sweet-origins": "https://sweetoriginschocolate.com",
    "tabeeze": "https://tabeeze.com",
    "terminal-b-intl-llc": "https://shoptheterminal.com",
    "thanksgiving-coffee-co": "https://thanksgivingcoffee.com",
    "thrive-farmers-international-inc": "https://thrivefarmers.com",
    "triibe-inc": "https://triibe.co",
    "aca-cellars-llc": "https://troisnoix.com",
    "unni-corporation": "https://shopunni.com",
    "wallaroo-hat-company": "https://wallaroohats.com",
    "wonderstate-coffee": "https://wonderstatecoffee.com",
    "american-halal-company-pbc-dba-saffron-road-foods": "https://saffronroadfood.com",
    "altos-planos": "https://altosplanos.co",
    "amasar-llc": "https://amasar.co",
}

with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json') as f:
    companies = json.load(f)

found = 0
for i, c in enumerate(companies):
    if c.get('website'):
        continue
    slug = c.get('slug', '')
    if slug in FIXES:
        url = FIXES[slug]
        ok = check_url(url)
        if ok:
            companies[i]['website'] = url
            found += 1
            log(f"  OK: {c['name']} -> {url}")
        else:
            # Try with www
            url2 = url.replace("https://", "https://www.")
            ok2 = check_url(url2)
            if ok2:
                companies[i]['website'] = url2
                found += 1
                log(f"  OK (www): {c['name']} -> {url2}")
            else:
                log(f"  FAIL: {c['name']} -> {url} (and {url2})")

log(f"\nFixed {found} more")

# Check remaining
still = [c['name'] for c in companies if not c.get('website')]
log(f"Still missing: {len(still)}")
for n in still:
    log(f"  {n}")

# Save
with open('/Applications/worker-owned/purposeowned/bcorp_us_hq_ecommerce.json', 'w') as f:
    json.dump(companies, f, indent=2)

with open("/Applications/worker-owned/purposeowned/bcorp_us_ecommerce.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["name", "slug", "industry", "sector", "hq_city", "hq_state",
                      "size", "score", "certified_date", "website", "bcorp_profile_url"])
    for c in sorted(companies, key=lambda x: (x.get("industry",""), x.get("name",""))):
        ts = c.get("initialCertificationDateTimestamp")
        cert_date = ""
        if ts:
            try: cert_date = datetime.fromtimestamp(int(ts)/1000).strftime("%Y-%m-%d")
            except: pass
        slug = c.get("slug", "")
        writer.writerow([
            c.get("name",""), slug, c.get("industry",""), c.get("sector",""),
            c.get("hqCity",""), c.get("hqProvince",""),
            c.get("size",""), c.get("latestVerifiedScore",""), cert_date,
            c.get("website",""),
            f"https://www.bcorporation.net/en-us/find-a-b-corp/company/{slug}/" if slug else "",
        ])

total = len([c for c in companies if c.get("website")])
log(f"\nTotal websites: {total}/{len(companies)}")
