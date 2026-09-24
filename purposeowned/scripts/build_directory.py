#!/usr/bin/env python3
"""
Build a directory JSON for purposeowned.info that includes ALL known
purpose-owned companies, not just those with products on the site.

Output: purposeowned/site/public/data/directory.json
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')

# Map B Corp industries → our site categories
INDUSTRY_MAP = {
    # Food & Pantry
    'Food products': 'Food & Pantry',
    'Beverages': 'Food & Pantry',
    'Agricultural Processing': 'Food & Pantry',
    'Agicultural support/post-harvest': 'Food & Pantry',
    'Growing perennial crops': 'Food & Pantry',
    'Growing non-perennial crops': 'Food & Pantry',
    'Mixed Farming': 'Food & Pantry',
    'Fishing & aquaculture': 'Food & Pantry',
    'Animal Production': 'Food & Pantry',
    'Restaurants & food service': 'Food & Pantry',
    'Beverage serving & bars': 'Food & Pantry',
    'Cleaning products': 'Food & Pantry',
    # Apparel
    'Apparel': 'Apparel',
    'Leather & related products': 'Apparel',
    # Personal Care
    'Personal care products': 'Personal Care',
    'Pharmaceutical products': 'Personal Care',
    'Hairdressing & other beauty services': 'Personal Care',
    # Home Goods
    'Other manufacturing': 'Home Goods',
    'Chemicals & chemical products': 'Home Goods',
    'Paper & paper products': 'Home Goods',
    'Rubber & plastics products': 'Home Goods',
    'Wood & wood products': 'Home Goods',
    'Electrical equipment': 'Home Goods',
    'Fabricated metal products': 'Home Goods',
    'Other non-metal minerals': 'Home Goods',
    'Other non-metallic minerals': 'Home Goods',
    'Basic metals & products': 'Home Goods',
    'General retail via Internet': 'Home Goods',
    'Other retail sale': 'Home Goods',
    'General stores': 'Home Goods',
    'Other/general wholesale trade': 'Home Goods',
    'General second-hand goods': 'Home Goods',
    # Sporting Goods
    'Sports goods': 'Sporting Goods',
    'Other sports': 'Sporting Goods',
    'Athletic & fitness centers': 'Sporting Goods',
    # Furniture
    'Furniture': 'Furniture',
    # Textiles & Rugs
    'Textiles': 'Textiles & Rugs',
    # Jewelry
    'Jewelry & related articles': 'Jewelry',
    # Media / Books (→ Home Goods as catch-all for consumer products)
    'Books or other media': 'Home Goods',
    'Book publishing': 'Home Goods',
    'Printing & recorded media': 'Home Goods',
    'Games & toys': 'Home Goods',
    'Computer & electronic products': 'Home Goods',
    'Computers & electronics': 'Home Goods',
    'Medical & dental supplies': 'Home Goods',
    'Machinery & equipment': 'Home Goods',
    'Other transport equipment': 'Home Goods',
}

def bcorp_url(slug):
    return f'https://www.bcorporation.net/en-us/find-a-b-corp/company/{slug}'

def clean_name(name):
    if not name:
        return name
    # Remove trailing legal suffixes for cleaner display
    return name.strip()

def main():
    # Load B Corps
    with open(os.path.join(ROOT, 'bcorp_us_companies.json')) as f:
        bcorps_all = json.load(f)

    # Load B Corp e-commerce subset (has websites)
    with open(os.path.join(ROOT, 'bcorp_us_hq_ecommerce.json')) as f:
        bcorps_ecom = {b['name']: b for b in json.load(f)}

    # Load benefit corps
    with open(os.path.join(ROOT, 'benefit_corps.json')) as f:
        bencorps = json.load(f)

    # Load benefit corp e-commerce subset
    with open(os.path.join(ROOT, 'benefit_corps_ecommerce.json')) as f:
        bencorps_ecom = {b['name']: b for b in json.load(f)}

    # Load current search.json to get product counts
    with open(os.path.join(SITE, 'public', 'data', 'search.json')) as f:
        search = json.load(f)

    store_products = {}
    for p in search['p']:
        store = search['s'][p[0]]
        store_products[store['n']] = store_products.get(store['n'], 0) + 1

    store_urls = {s['n']: s['u'] for s in search['s']}
    store_industries = {s['n']: s['i'] for s in search['s']}

    # Build unified company list
    companies = {}  # key = name (deduped)

    # B Corps
    for b in bcorps_all:
        name = clean_name(b['name'])
        industry = b.get('industry', '')
        category = INDUSTRY_MAP.get(industry)

        # Get website: prefer e-commerce subset, fall back to B Corp profile
        ecom = bcorps_ecom.get(name)
        website = ecom['website'] if ecom and ecom.get('website') else None
        profile_url = bcorp_url(b['slug']) if b.get('slug') else None

        # Use store URL if we have products for this company
        if name in store_urls:
            website = store_urls[name]
            category = store_industries.get(name, category)

        companies[name] = {
            'name': name,
            'url': website or profile_url,
            'types': ['B'],
            'category': category,
            'industry': industry,
            'description': (b.get('description') or '')[:200].strip(),
            'city': b.get('hqCity', ''),
            'state': b.get('hqProvince', ''),
            'products': store_products.get(name, 0),
        }

    # Benefit corps (merge, don't overwrite)
    for b in bencorps:
        if b.get('standing') != 'Good Standing':
            continue
        name = clean_name(b['name'])
        website = b.get('website')

        if name in store_urls:
            website = store_urls[name]

        if name in companies:
            # Already a B Corp — add benefit corp type
            if 'F' not in companies[name]['types']:
                companies[name]['types'].append('F')
            if not companies[name]['url'] and website:
                companies[name]['url'] = website
        else:
            category = store_industries.get(name)
            companies[name] = {
                'name': name,
                'url': website,
                'types': ['F'],
                'category': category,
                'industry': '',
                'description': '',
                'city': b.get('city', ''),
                'state': b.get('state', ''),
                'products': store_products.get(name, 0),
            }

    # Trust-owned companies (from Mark's PTON CSV)
    # Aliases: trust CSV name -> existing B Corp / benefit corp name
    TRUST_ALIASES = {
        'Biohabitats': 'Biohabitats, Inc.',
        'Craftsman Technology Group': 'Craftsman Technology Group, LLC',
        'Heath Ceramics': 'Heath Ceramics, LTD',
        'Natural Investments': 'Natural Investments PBLLC',
        'Geoship': 'GeoShip',
    }
    trust_path = os.path.join(ROOT, 'trust_companies.json')
    if os.path.exists(trust_path):
        with open(trust_path) as f:
            trust_cos = json.load(f)

        for t in trust_cos:
            name = clean_name(t['name'])
            website = t.get('website', '')
            # Resolve alias to existing company name
            canonical = TRUST_ALIASES.get(name, name)

            if canonical in store_urls:
                website = store_urls[canonical]

            if canonical in companies:
                # Already exists (e.g. a B Corp that's also trust-owned) -- add type
                if 'S' not in companies[canonical]['types']:
                    companies[canonical]['types'].append('S')
                if not companies[canonical]['url'] and website:
                    companies[canonical]['url'] = website
            else:
                companies[name] = {
                    'name': name,
                    'url': website or None,
                    'types': ['S'],
                    'category': store_industries.get(name),
                    'industry': t.get('industry', ''),
                    'description': t.get('description', ''),
                    'city': t.get('city', ''),
                    'state': t.get('state', ''),
                    'products': store_products.get(name, 0),
                }

        print(f"Trust companies loaded: {len(trust_cos)}")

    all_companies = list(companies.values())

    # Filter to only those with a URL (no point listing companies we can't link to)
    with_url = [c for c in all_companies if c.get('url')]

    # Categorized vs uncategorized
    categorized = [c for c in with_url if c.get('category')]
    uncategorized = [c for c in with_url if not c.get('category')]

    # Stats
    cats = {}
    for c in categorized:
        cat = c['category']
        cats[cat] = cats.get(cat, 0) + 1

    print(f"Total companies: {len(all_companies)}")
    print(f"With URL: {len(with_url)}")
    print(f"Categorized: {len(categorized)}")
    print(f"Uncategorized: {len(uncategorized)}")
    print(f"\nBy category:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {count:4d}  {cat}")

    # Build compact output
    # Format: { categories: [...], companies: [...] }
    # Each company: { n: name, u: url, t: types[], c: categoryIndex, d: description, l: "city, state", p: productCount }
    cat_list = sorted(cats.keys())
    cat_idx = {c: i for i, c in enumerate(cat_list)}

    output = {
        'categories': cat_list,
        'companies': []
    }

    for c in sorted(with_url, key=lambda x: x['name'].lower()):
        entry = {
            'n': c['name'],
            'u': c['url'],
            't': c['types'],
        }
        if c.get('category'):
            entry['c'] = cat_idx[c['category']]
        if c.get('description'):
            entry['d'] = c['description']
        loc_parts = [c.get('city', ''), c.get('state', '')]
        loc = ', '.join(p for p in loc_parts if p)
        if loc:
            entry['l'] = loc
        if c['products'] > 0:
            entry['p'] = c['products']
        output['companies'].append(entry)

    out_path = os.path.join(SITE, 'public', 'data', 'directory.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    size_kb = os.path.getsize(out_path) / 1024
    print(f"\nWrote {out_path} ({size_kb:.0f} KB, {len(output['companies'])} companies)")

if __name__ == '__main__':
    main()
