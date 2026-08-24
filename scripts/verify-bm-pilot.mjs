#!/usr/bin/env node
// Verify pilot scrape decisions against Bull Moose's per-product
// /availabilitydetail endpoint (ground truth for shipping status).
// Usage: node scripts/verify-bm-pilot.mjs [keptSample] [skippedSample]

import { readFileSync } from 'fs';

const PILOT_FILE = '/tmp/bm-pilot.json';
const KEPT_SAMPLE = parseInt(process.argv[2] || '30', 10);
const SKIP_SAMPLE = parseInt(process.argv[3] || '20', 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Ground truth: shipping status from the store-ship divs (same logic as
// scripts/check-bm-availability.mjs, proven correct on 2026-08-23).
async function checkShippable(productId) {
  try {
    const res = await fetch(`https://www.bullmoose.com/availabilitydetail/${productId}/0`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    const html = json.data?.data || '';
    const shipDivs = [...html.matchAll(/class="store-ship"[\s\S]*?<span class="av\s+([^"]+)"/g)];
    if (shipDivs.length === 0) return null;
    return shipDivs.some(m => /av10|av11|av21|av40/.test(m[1]));
  } catch {
    return null;
  }
}

function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

const pilot = JSON.parse(readFileSync(PILOT_FILE, 'utf8'));
console.log(`Pilot data: ${pilot.kept.length} kept, ${pilot.skippedSamples.length} skipped samples`);
console.log(`avStats: ${JSON.stringify(pilot.avStats)}\n`);

// NOTE: the /availabilitydetail endpoint reflects WAREHOUSE STOCK ONLY — it
// reports av50 for ALL Special Order (av21) items even though they can be
// ordered and shipped (verified 2026-08-24: 15/15 card-av21 items showed
// detail-av50, while 8/8 card-av11 items showed detail-av11). So endpoint
// cross-checking only applies to av10/av11/av40 keeps; av21 keeps are listed
// for manual review instead.
const verifiable = pilot.kept.filter(p => p.shipStatus !== 'av21');
const specialOrder = pilot.kept.filter(p => p.shipStatus === 'av21');
const keptSample = sample(verifiable, KEPT_SAMPLE);
const skipSample = sample(pilot.skippedSamples, SKIP_SAMPLE);

let mismatches = 0, unknowns = 0;

console.log(`--- Checking ${keptSample.length} KEPT av10/av11/av40 items (endpoint should confirm) ---`);
for (const p of keptSample) {
  const truth = await checkShippable(p.productId ?? p.url.match(/\/p\/(\d+)\//)?.[1]);
  const mark = truth === true ? 'OK  ' : truth === false ? 'MISMATCH' : '??? ';
  if (truth === false) mismatches++;
  if (truth === null) unknowns++;
  console.log(`  [${mark}] (${p.shipStatus}) ${p.title.slice(0, 60)}  ${p.url}`);
  await sleep(150);
}

console.log(`\n--- ${specialOrder.length} kept av21 (Special Order) items — endpoint can't verify these; manual sample: ---`);
for (const p of sample(specialOrder, 5)) {
  console.log(`  [MANUAL] ${p.title.slice(0, 60)}  ${p.url}`);
}

console.log(`\n--- Checking ${skipSample.length} SKIPPED items (should all be unshippable) ---`);
for (const p of skipSample) {
  const id = p.url.match(/\/p\/(\d+)\//)?.[1];
  const truth = await checkShippable(id);
  const mark = truth === false ? 'OK  ' : truth === true ? 'MISMATCH' : '??? ';
  if (truth === true) mismatches++;
  if (truth === null) unknowns++;
  console.log(`  [${mark}] ${p.title.slice(0, 60)}  (${p.reason})  ${p.url}`);
  await sleep(150);
}

console.log(`\nResult: ${mismatches} mismatches, ${unknowns} unknown (endpoint gave no data)`);
if (mismatches === 0) console.log('PASS — filter decisions match ground truth.');
else console.log('FAIL — investigate mismatches before full scrape.');
