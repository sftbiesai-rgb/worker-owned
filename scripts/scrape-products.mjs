#!/usr/bin/env node
/**
 * scrape-products.mjs
 * Pulls product data from worker-owned stores (Shopify + WooCommerce)
 * and writes to data/products.json
 *
 * Usage: node scripts/scrape-products.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKETPLACE_JSON = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const OUT_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MAX_PER_STORE = 100;
const FETCH_TIMEOUT_MS = 12000;
const DELAY_BETWEEN_STORES_MS = 400;

const entries = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));

function getBaseUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch { return null; }
}

// If entry URL contains /collections/<handle>, use that narrower endpoint
function shopifyProductsUrl(entryUrl) {
  try {
    const u = new URL(entryUrl);
    const base = `${u.protocol}//${u.hostname}`;
    const m = u.pathname.match(/\/collections\/([^/]+)/);
    if (m) return `${base}/collections/${m[1]}/products.json?limit=250`;
    return `${base}/products.json?limit=250`;
  } catch { return null; }
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', ...(opts.headers ?? {}) },
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function tryShopify(entry) {
  const productsUrl = shopifyProductsUrl(entry.url);
  if (!productsUrl) return null;
  try {
    const res = await fetchWithTimeout(productsUrl);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return null;
    const data = await res.json();
    if (!Array.isArray(data?.products)) return null;

    const products = data.products
      .filter(p => p.images?.length > 0 && p.variants?.[0]?.price && parseFloat(p.variants[0].price) > 0)
      .slice(0, MAX_PER_STORE)
      .map(p => ({
        id: `${entry.id}-${p.id}`,
        title: p.title,
        price: p.variants[0].price,
        image: p.images[0].src,
        url: `${getBaseUrl(entry.url)}/products/${p.handle}`,
        store_name: entry.name,
        store_url: entry.url,
        ownership_type: entry.ownership_type,
        site_section: entry.site_section,
        tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      }));

    return products.length ? products : null;
  } catch { return null; }
}

// Southern Exposure Seed Exchange — custom Haskell/Servant API
async function trySouthernExposure(entry) {
  if (!entry.url.includes('southernexposure.com')) return null;
  const IMAGE_BASE = 'https://www.southernexposure.com/media/';
  try {
    const res = await fetchWithTimeout('https://www.southernexposure.com/api/products/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        query: '', searchDescription: false,
        filterOrganic: false, filterHeirloom: false,
        filterRegional: false, filterSmallGrower: false,
        page: 1, perPage: MAX_PER_STORE,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.products)) return null;

    const products = data.products
      .filter(p => p.product?.images?.length > 0 && p.variants?.[0]?.price > 0)
      .map((p, i) => {
        const prod = p.product;
        const price = p.variants[0].salePrice ?? p.variants[0].price;
        return {
          id: `${entry.id}-se-${prod.id}`,
          title: prod.name,
          price: (price / 100).toFixed(2),
          image: `${IMAGE_BASE}${(prod.images[0].md ?? prod.images[0].sm ?? prod.images[0].lg)?.src ?? prod.images[0].original}`,
          url: `https://www.southernexposure.com/products/${prod.slug}.html`,
          store_name: entry.name,
          store_url: entry.url,
          ownership_type: entry.ownership_type,
          site_section: entry.site_section,
          tags: [],
        };
      });

    return products.length ? products : null;
  } catch { return null; }
}

// Google Merchant Center XML feed — a public standard many stores publish
const MERCHANT_FEED_PATHS = [
  '/merchant-feed.xml',
  '/feeds/google.xml',
  '/feed.xml',
  '/google-shopping-feed.xml',
  '/feeds/products.xml',
];

function extractXmlField(item, tag) {
  const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

async function tryMerchantFeed(entry) {
  const base = getBaseUrl(entry.url);
  if (!base) return null;

  for (const path of MERCHANT_FEED_PATHS) {
    try {
      const res = await fetchWithTimeout(`${base}${path}`);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('xml') && !ct.includes('text')) continue;
      const xml = await res.text();
      if (!xml.includes('<item>') && !xml.includes('<item ')) continue;

      // Split into <item> blocks
      const itemMatches = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)];
      if (!itemMatches.length) continue;

      const products = itemMatches
        .map((m, i) => {
          const item = m[0];
          const title = extractXmlField(item, 'title');
          const link = extractXmlField(item, 'link') || extractXmlField(item, 'g:link');
          const image = extractXmlField(item, 'g:image_link') || extractXmlField(item, 'image_link');
          const priceRaw = extractXmlField(item, 'g:price') || extractXmlField(item, 'price');
          const price = parseFloat(priceRaw.replace(/[^0-9.]/g, ''));
          const availability = extractXmlField(item, 'g:availability') || 'in stock';
          if (!title || !image || !link || isNaN(price) || price <= 0) return null;
          if (availability.toLowerCase().includes('out')) return null;
          return {
            id: `${entry.id}-mf-${i}`,
            title,
            price: price.toFixed(2),
            image,
            url: link,
            store_name: entry.name,
            store_url: entry.url,
            ownership_type: entry.ownership_type,
            site_section: entry.site_section,
            tags: [],
          };
        })
        .filter(Boolean)
        .slice(0, MAX_PER_STORE);

      if (products.length) return products;
    } catch { continue; }
  }
  return null;
}

async function tryWooCommerce(entry) {
  const base = getBaseUrl(entry.url);
  if (!base) return null;
  try {
    const res = await fetchWithTimeout(`${base}/wp-json/wc/store/v1/products?per_page=100`);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;

    const minorUnit = data[0]?.prices?.currency_minor_unit ?? 2;
    const divisor = Math.pow(10, minorUnit);

    const products = data
      .filter(p => p.images?.length > 0 && p.prices?.price && parseInt(p.prices.price) > 0)
      .slice(0, MAX_PER_STORE)
      .map(p => ({
        id: `${entry.id}-wc-${p.id}`,
        title: p.name,
        price: (parseInt(p.prices.price) / divisor).toFixed(2),
        image: p.images[0].src,
        url: p.permalink,
        store_name: entry.name,
        store_url: entry.url,
        ownership_type: entry.ownership_type,
        site_section: entry.site_section,
        tags: p.tags?.map(t => t.name) ?? [],
      }));

    return products.length ? products : null;
  } catch { return null; }
}

async function main() {
  mkdirSync(dirname(OUT_FILE), { recursive: true });

  const allProducts = [];
  let scraped = 0, skipped = 0;

  // Deduplicate entries by store base URL so we don't hit the same store twice
  // (some stores appear multiple times with different entry names)
  const seen = new Set();

  for (const entry of entries) {
    if (!entry.url) { skipped++; continue; }
    const base = getBaseUrl(entry.url);
    if (!base) { skipped++; continue; }

    // For collection-specific URLs, key by the full URL; otherwise by base
    const shopifyUrl = shopifyProductsUrl(entry.url);
    const dedupeKey = shopifyUrl ?? base;
    if (seen.has(dedupeKey)) {
      console.log(`Skip duplicate: ${entry.name}`);
      continue;
    }
    seen.add(dedupeKey);

    process.stdout.write(`[${entry.id}] ${entry.name}... `);

    let products = await tryShopify(entry);
    if (!products) products = await tryWooCommerce(entry);
    if (!products) products = await trySouthernExposure(entry);
    if (!products) products = await tryMerchantFeed(entry);

    if (products?.length) {
      allProducts.push(...products);
      console.log(`${products.length} products (${entry.ownership_type})`);
      scraped++;
    } else {
      console.log('no products found');
      skipped++;
    }

    await new Promise(r => setTimeout(r, DELAY_BETWEEN_STORES_MS));
  }

  writeFileSync(OUT_FILE, JSON.stringify(allProducts, null, 2));
  console.log(`\nDone: ${scraped} stores with products, ${skipped} skipped`);
  console.log(`Total products: ${allProducts.length}`);
  console.log(`Written to: ${OUT_FILE}`);
}

main().catch(console.error);
