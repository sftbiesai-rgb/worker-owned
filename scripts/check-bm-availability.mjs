#!/usr/bin/env node
// Check Bull Moose SHIPPING availability via their AJAX endpoint.
// Removes products that cannot be shipped (av30/av50 at ALL stores).
// Keeps: In Stock (av10/av11), Special Order (av21), Pre-order (av40).
// Usage: node scripts/check-bm-availability.mjs [--dry-run]

import { readFileSync, writeFileSync } from 'fs';

const CONCURRENCY = 10;
const DELAY_MS = 100;
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkShippable(productId) {
  try {
    const res = await fetch(`https://www.bullmoose.com/availabilitydetail/${productId}/0`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;

    const html = json.data?.data || '';
    // Extract ONLY shipping status from store-ship divs (not pickup status)
    const shipDivs = [...html.matchAll(/class="store-ship"[\s\S]*?<span class="av\s+([^"]+)"/g)];
    if (shipDivs.length === 0) return null; // no shipping data

    // Shippable if ANY store shows av10, av11, av21, or av40 for shipping
    const canShip = shipDivs.some(m => /av10|av11|av21|av40/.test(m[1]));
    return canShip;
  } catch {
    return null;
  }
}

async function main() {
  const products = JSON.parse(readFileSync('public/data/products.json', 'utf8'));
  const bmProducts = products.filter(p => p.store_url?.includes('bullmoose'));
  console.log(`Bull Moose products: ${bmProducts.length}`);

  let checked = 0, removed = 0, kept = 0, unknown = 0;
  const removeIds = new Set();
  const startTime = Date.now();

  for (let i = 0; i < bmProducts.length; i += CONCURRENCY) {
    const batch = bmProducts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (p) => {
      const idMatch = p.url.match(/\/p\/(\d+)\//);
      if (!idMatch) return { product: p, shippable: null };
      const shippable = await checkShippable(idMatch[1]);
      return { product: p, shippable };
    }));

    for (const { product, shippable } of results) {
      checked++;
      if (shippable === false) {
        removed++;
        removeIds.add(product.id);
      } else if (shippable === true) {
        kept++;
      } else {
        unknown++;
      }
    }

    if (checked % 500 === 0 || checked === bmProducts.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (checked / (Date.now() - startTime) * 1000).toFixed(1);
      console.log(`  ${checked}/${bmProducts.length} checked, ${removed} to remove, ${kept} shippable, ${unknown} unknown, ${rate}/sec, ${elapsed}s elapsed`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${checked} checked, ${removed} removed, ${kept} kept, ${unknown} unknown`);

  if (!DRY_RUN && removeIds.size > 0) {
    const filtered = products.filter(p => !removeIds.has(p.id));
    console.log(`Products: ${products.length} → ${filtered.length} (removed ${removeIds.size})`);
    writeFileSync('public/data/products.json', JSON.stringify(filtered, null, 2));
    console.log('Saved products.json');
  } else if (DRY_RUN) {
    console.log('(dry run — no changes saved)');
  }
}

main();
