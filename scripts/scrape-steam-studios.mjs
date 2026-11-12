#!/usr/bin/env node
/**
 * Pulls released games for worker-owned game studios from the Steam store
 * and merges them into public/data/products.json.
 *
 * Uses Steam's public store endpoints (no key needed):
 *   - search/results?developer=X&json=1  → app ids for a developer
 *   - api/appdetails                      → name, type, price, release, developers
 *
 * Skips demos, soundtracks, DLC and unreleased (coming soon) games, so rerun
 * after a launch to pick new games up.
 *
 * Usage:
 *   node scripts/scrape-steam-studios.mjs            # scrape + merge
 *   node scripts/scrape-steam-studios.mjs --dry-run  # print only
 *   node scripts/split-products.mjs                  # then re-split (npm run build does this)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Directory entry name → Steam developer name(s)
const STUDIOS = {
  'Pixel Pushers Union 512': ['Pixel Pushers Union 512'],
  'Lucid Tales': ['Lucid Tales'],
  'Aesthetician Labs': ['Aesthetician Labs'],
  'Manzanita Interactive': ['Manzanita Interactive'],
  'Wraith Games': ['Wraith Games'],
  'Punch Up Games': ['Punch Up Games'],
  'Hidden Horses': ['Hidden Horses'],
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function appIdsForDeveloper(dev) {
  const url = `https://store.steampowered.com/search/results/?developer=${encodeURIComponent(dev)}&json=1&cc=us`;
  const data = await (await fetch(url)).json();
  return (data.items || [])
    .map(i => (i.logo || '').match(/\/apps\/(\d+)\//)?.[1])
    .filter(Boolean);
}

async function appDetails(appid) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`;
  const data = await (await fetch(url)).json();
  return data[appid]?.success ? data[appid].data : null;
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const products = [];

  for (const [storeName, devs] of Object.entries(STUDIOS)) {
    const entry = marketplace.find(e => e.name === storeName);
    if (!entry) { console.warn(`! ${storeName} not in marketplace.json, skipping`); continue; }

    const ids = new Set();
    for (const dev of devs) (await appIdsForDeveloper(dev)).forEach(id => ids.add(id));

    for (const appid of ids) {
      await sleep(400);
      const d = await appDetails(appid);
      if (!d) continue;
      // Developer search is fuzzy; require an exact developer match
      const ours = (d.developers || []).some(x => devs.some(dev => x.toLowerCase() === dev.toLowerCase()));
      if (!ours || d.type !== 'game' || d.release_date?.coming_soon) {
        console.log(`  - skip ${d.name} (${d.type}${d.release_date?.coming_soon ? ', coming soon' : ''}${ours ? '' : ', other developer'})`);
        continue;
      }
      // Regular price, not a temporary sale price
      const price = d.is_free ? '0.00'
        : d.price_overview ? (d.price_overview.initial / 100).toFixed(2) : null;
      products.push({
        id: `${entry.id}-steam-${appid}`,
        title: d.name,
        price,
        available: true,
        image: d.header_image,
        url: `https://store.steampowered.com/app/${appid}/`,
        store_name: entry.name,
        store_url: entry.url,
        ownership_type: entry.ownership_type,
        site_section: 'Games',
        tags: ['video games', d.is_free ? 'free to play' : null].filter(Boolean),
      });
      console.log(`  + ${storeName}: ${d.name} ($${price})`);
    }
  }

  console.log(`\n${products.length} games found`);
  if (DRY_RUN) return;

  const stores = new Set(Object.keys(STUDIOS));
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const others = existing.filter(p => !stores.has(p.store_name));
  const final = [...others, ...products];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`Wrote ${final.length} total products to products.json (${products.length} Steam, ${others.length} other)`);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
