#!/usr/bin/env node
/**
 * Pulls AVID Products headsets/earbuds and merges them into public/data/products.json.
 *
 * AVID (100% ESOP) doesn't sell direct, so products link to Encore Data Products,
 * one of AVID's listed authorized resellers. CDW was the first choice but its bot
 * protection blocks scripted requests; Encore's BigCommerce brand page is plain HTML.
 *
 * Usage:
 *   node scripts/scrape-avid.mjs            # scrape + merge
 *   node scripts/scrape-avid.mjs --dry-run  # print only
 *   node scripts/split-products.mjs         # then re-split (npm run build does this)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const DRY_RUN = process.argv.includes('--dry-run');

const STORE_NAME = 'AVID Products';
const BRAND_URL = 'https://www.encoredataproducts.com/avid-products/?limit=100';

const decode = s => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function tagsFor(title) {
  const t = title.toLowerCase();
  const tags = ['headphones', 'school supplies'];
  if (/earbud|earphone/.test(t)) tags.push('earbuds');
  if (/headset|mic\b|microphone/.test(t)) tags.push('headset');
  if (/adapter/.test(t)) tags.push('audio adapter');
  if (/usb-c|usbc/.test(t)) tags.push('usb-c');
  return [...new Set(tags)];
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const entry = marketplace.find(e => e.name === STORE_NAME);
  if (!entry) throw new Error(`${STORE_NAME} not in marketplace.json`);

  const res = await fetch(BRAND_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (workerowned.info product index)' } });
  if (!res.ok) throw new Error(`Encore brand page returned ${res.status}`);
  const html = await res.text();

  const products = [];
  for (const card of html.split('<article class="card').slice(1)) {
    const link = card.match(/card-title">\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)/);
    if (!link) continue;
    const url = link[1].split('?')[0];
    const title = decode(link[2]);
    const price = card.match(/price--withoutTax[^>]*>\s*\$([\d,.]+)/)?.[1]?.replace(/,/g, '');
    const image = card.match(/<img src="([^"]+)"/)?.[1];
    const productId = image?.match(/\/products\/(\d+)\//)?.[1] || url.replace(/\/$/, '').split('/').pop();
    products.push({
      id: `${entry.id}-encore-${productId}`,
      title,
      price: price ? Number(price).toFixed(2) : null,
      available: !/out of stock|sold out/i.test(card),
      image,
      url,
      store_name: entry.name,
      store_url: entry.url,
      ownership_type: entry.ownership_type,
      site_section: entry.site_section,
      tags: tagsFor(title),
    });
  }

  for (const p of products) console.log(`  + ${p.title} ($${p.price})${p.available ? '' : ' [out of stock]'}`);
  console.log(`\n${products.length} AVID products found`);
  // A layout change would silently wipe the listing; keep what we have instead
  if (products.length < 10) throw new Error('Too few products parsed; Encore layout may have changed');
  if (DRY_RUN) return;

  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const others = existing.filter(p => p.store_name !== STORE_NAME);
  const final = [...others, ...products];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`Wrote ${final.length} total products to products.json (${products.length} AVID, ${others.length} other)`);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
