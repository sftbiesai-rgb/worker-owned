#!/usr/bin/env node
/**
 * Pulls Markertek products from a curated set of categories and merges them into
 * public/data/products.json.
 *
 * Markertek (100% ESOP) carries ~70K items, mostly broadcast install hardware.
 * We only take categories a regular shopper would search for: headphones, mics,
 * audio interfaces, monitors, lighting, tripods, cameras, everyday cables.
 *
 * Each category page embeds a numeric CategoryID; POSTing it to /Products.aspx
 * returns the whole category as JSON (the site paginates client-side).
 *
 * Usage:
 *   node scripts/scrape-markertek.mjs            # scrape + merge
 *   node scripts/scrape-markertek.mjs --dry-run  # print only
 *   node scripts/split-products.mjs              # then re-split (npm run build does this)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const DRY_RUN = process.argv.includes('--dry-run');

const STORE_NAME = 'Markertek';
const BASE = 'https://www.markertek.com';
const UA = 'Mozilla/5.0 (workerowned.info product index)';
const DELAY_MS = 1500;

// category slug -> tags added to every product in it
const CATEGORIES = {
  'headphones': ['headphones'],
  'headphone-amplifiers': ['headphone amplifier', 'audio'],
  'bluetooth-audio': ['bluetooth', 'audio'],
  'speakers-studio-monitors': ['speakers', 'studio monitors'],
  'pa-speakers': ['speakers', 'pa speakers'],
  'turntables': ['turntable', 'vinyl'],
  'usb-audio-interface': ['audio interface', 'recording'],
  'thunderbolt-audio-interface': ['audio interface', 'recording'],
  'podcasting-kits': ['podcasting', 'microphone'],
  'usb-computer-microphones': ['microphone', 'usb microphone'],
  'condenser-microphones': ['microphone'],
  'dynamic-microphones': ['microphone'],
  'lavalier-microphones': ['microphone', 'lavalier'],
  'shotgun-microphones': ['microphone', 'shotgun mic'],
  'instrument-microphones': ['microphone'],
  'headset-microphones': ['microphone', 'headset'],
  'wireless-microphone-systems': ['microphone', 'wireless microphone'],
  'camera-mount-wireless-microphones': ['microphone', 'wireless microphone'],
  'microphone-stands': ['mic stand'],
  'mic-boom-arms-fishpoles': ['mic boom arm'],
  'microphone-shock-mounts': ['microphone accessories'],
  'microphone-windscreens': ['microphone accessories'],
  'portable-digital-audio-recorders': ['audio recorder', 'recording'],
  'analog-audio-mixers': ['audio mixer'],
  'digital-audio-mixers': ['audio mixer'],
  'dj-mixers': ['dj', 'audio mixer'],
  'video-conferencing-webcams': ['webcam'],
  'usb-video-converters': ['capture card', 'streaming'],
  'video-pci-cards-capture-cards': ['capture card', 'streaming'],
  'on-camera-lights': ['video lighting', 'camera'],
  'portable-video-lighting': ['video lighting'],
  'video-lighting-kits': ['video lighting'],
  'light-stands': ['light stand', 'video lighting'],
  'video-backdrops': ['backdrop', 'green screen'],
  'tripods-fluid-heads': ['tripod', 'camera'],
  'camera-sliders-accessories': ['camera slider', 'camera'],
  'steadicams-camera-stabilizers': ['gimbal', 'camera stabilizer', 'camera'],
  'pov-cameras': ['camera', 'action camera'],
  'video-cameras-and-camcorders': ['camera', 'camcorder'],
  'camera-cases': ['camera case', 'camera'],
  'xlr-cables-microphone-cables': ['xlr cable', 'cables'],
  'usb-cables': ['usb cable', 'cables'],
  'usb-adapters': ['usb adapter', 'adapters'],
  'usb-hubs': ['usb hub'],
  'usb-thumb-drives': ['usb flash drive'],
  'flashlights-work-lights': ['flashlight', 'work light'],
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => String(s || '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&trade;|&reg;/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

async function fetchCategory(slug) {
  const page = await fetch(`${BASE}/category/${slug}`, { headers: { 'User-Agent': UA } });
  if (!page.ok) throw new Error(`category page ${slug} returned ${page.status}`);
  const id = (await page.text()).match(/var CategoryID\s*=\s*(\d+)/)?.[1];
  if (!id) throw new Error(`no CategoryID on ${slug}`);
  await sleep(DELAY_MS);
  const res = await fetch(`${BASE}/Products.aspx`, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    body: new URLSearchParams({ ID: id, Action: 'CAT', Brand: '', Filter: '', Range: '' }),
  });
  if (!res.ok) throw new Error(`Products.aspx ${slug} returned ${res.status}`);
  const data = await res.json();
  return typeof data.Items === 'string' ? JSON.parse(data.Items || '[]') : (data.Items || []);
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const entry = marketplace.find(e => e.name === STORE_NAME);
  if (!entry) throw new Error(`${STORE_NAME} not in marketplace.json`);

  const byId = new Map();
  for (const [slug, catTags] of Object.entries(CATEGORIES)) {
    let items;
    try {
      items = await fetchCategory(slug);
    } catch (err) {
      console.log(`  ! ${slug}: ${err.message}`);
      await sleep(DELAY_MS);
      continue;
    }
    let added = 0;
    for (const it of items) {
      const price = Number(it.TP);
      // RO = request-a-quote items with no public price
      if (!it.ID || !it.U || it.RO || !(price > 0)) continue;
      const existing = byId.get(it.ID);
      if (existing) {
        existing.tags = [...new Set([...existing.tags, ...catTags])];
        continue;
      }
      const brand = decode(it.M);
      byId.set(it.ID, {
        id: `${entry.id}-mtk-${it.ID.toLowerCase()}`,
        title: decode(it.N),
        price: price.toFixed(2),
        // "outofstock" on Markertek still means orderable ("Usually Ships in 5-14 Days")
        available: !/preorder|discontinued|no longer available/i.test(`${it.SC} ${it.AVB}`),
        image: `${BASE}${String(it.IMG).replace('/125x125/', '/450x450/')}`,
        url: `${BASE}${it.U}`,
        store_name: entry.name,
        store_url: entry.url,
        ownership_type: entry.ownership_type,
        site_section: entry.site_section,
        tags: [...new Set([...catTags, ...(brand ? [brand.toLowerCase()] : [])])],
      });
      added++;
    }
    console.log(`  ${slug}: ${items.length} items, ${added} new`);
    await sleep(DELAY_MS);
  }

  const products = [...byId.values()];
  console.log(`\n${products.length} Markertek products (${products.filter(p => p.available).length} available)`);
  // A layout or endpoint change would silently wipe the listing; keep what we have instead
  if (products.length < 500) throw new Error('Too few products parsed; Markertek endpoint may have changed');
  if (DRY_RUN) return;

  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const others = existing.filter(p => p.store_name !== STORE_NAME);
  const final = [...others, ...products];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`Wrote ${final.length} total products to products.json (${products.length} Markertek, ${others.length} other)`);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
