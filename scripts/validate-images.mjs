#!/usr/bin/env node
/**
 * validate-images.mjs
 * Checks all product image URLs and removes products with broken images.
 *
 * Usage: node scripts/validate-images.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const CONCURRENCY = 20;
const TIMEOUT_MS = 8000;
const dryRun = process.argv.includes('--dry-run');

const products = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
console.log(`Checking ${products.length} product images (concurrency: ${CONCURRENCY})...`);

let checked = 0;
const broken = [];

async function checkImage(product) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(product.image, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      broken.push({ id: product.id, store: product.store_name, title: product.title, status: res.status });
    }
  } catch (e) {
    broken.push({ id: product.id, store: product.store_name, title: product.title, error: e.code || e.message });
  }
  checked++;
  if (checked % 500 === 0) process.stdout.write(`  ${checked}/${products.length}\n`);
}

// Process in batches
for (let i = 0; i < products.length; i += CONCURRENCY) {
  const batch = products.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(checkImage));
}

console.log(`\nChecked: ${checked}`);
console.log(`Broken: ${broken.length}`);

if (broken.length > 0) {
  // Group by store
  const byStore = {};
  for (const b of broken) {
    byStore[b.store] = (byStore[b.store] || 0) + 1;
  }
  console.log('\nBroken by store:');
  Object.entries(byStore).sort((a, b) => b[1] - a[1]).forEach(([store, count]) => {
    console.log(`  ${store}: ${count}`);
  });

  if (dryRun) {
    console.log('\n--dry-run: no changes written');
  } else {
    const brokenIds = new Set(broken.map(b => b.id));
    const cleaned = products.filter(p => !brokenIds.has(p.id));
    writeFileSync(PRODUCTS_FILE, JSON.stringify(cleaned, null, 2));
    console.log(`\nRemoved ${broken.length} products with broken images`);
    console.log(`Remaining: ${cleaned.length} products`);
  }
}
