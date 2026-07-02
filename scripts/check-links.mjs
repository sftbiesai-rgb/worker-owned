#!/usr/bin/env node
/**
 * check-links.mjs
 * Checks all URLs in marketplace.json, shops.json, and bars.json for dead links.
 * Reports: status code, redirect destination, DNS failures, timeouts.
 *
 * Usage: node scripts/check-links.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 10000;
const CONCURRENCY = 5;
const DELAY_MS = 200;

function normalizeUrl(url) {
  if (!url) return null;
  if (!url.startsWith('http')) url = `https://${url}`;
  return url;
}

async function checkUrl(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkerOwnedLinkChecker/1.0)' },
      redirect: 'manual',
    });
    clearTimeout(timer);

    const status = res.status;
    const location = res.headers.get('location') || null;

    if (status >= 300 && status < 400 && location) {
      // Follow one redirect to check final destination
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), TIMEOUT_MS);
      try {
        const finalUrl = location.startsWith('http') ? location : new URL(location, url).href;
        const res2 = await fetch(finalUrl, {
          signal: ctrl2.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkerOwnedLinkChecker/1.0)' },
          redirect: 'manual',
        });
        clearTimeout(timer2);
        return { status: res2.status, redirect: finalUrl, ok: res2.status >= 200 && res2.status < 400 };
      } catch (e) {
        clearTimeout(timer2);
        return { status, redirect: location, ok: false, error: e.cause?.code || e.message };
      }
    }

    return { status, ok: status >= 200 && status < 400 };
  } catch (e) {
    clearTimeout(timer);
    const code = e.cause?.code || e.message;
    if (code === 'ABORT_ERR' || e.name === 'AbortError') return { ok: false, error: 'TIMEOUT' };
    return { ok: false, error: code };
  }
}

async function processQueue(items, concurrency) {
  const results = [];
  let i = 0;

  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const { source, name, url } = items[idx];
      const normalized = normalizeUrl(url);
      if (!normalized) {
        results[idx] = { source, name, url, ok: false, error: 'NO_URL' };
        continue;
      }
      const result = await checkUrl(normalized);
      results[idx] = { source, name, url: normalized, ...result };

      const icon = result.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const detail = result.error || `${result.status}${result.redirect ? ` → ${result.redirect}` : ''}`;
      process.stdout.write(`${icon} [${source}] ${name} — ${detail}\n`);

      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  const marketplace = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'marketplace.json'), 'utf8'));
  const shops = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'shops.json'), 'utf8'));
  const bars = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'bars.json'), 'utf8'));

  const items = [
    ...marketplace.map(e => ({ source: 'marketplace', name: e.name, url: e.url })),
    ...shops.map(e => ({ source: 'shops', name: e.name, url: e.website })),
    ...bars.map(e => ({ source: 'bars', name: e.name, url: e.website })),
  ];

  console.log(`Checking ${items.length} URLs...\n`);

  const results = await processQueue(items, CONCURRENCY);

  const dead = results.filter(r => !r.ok);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${results.length - dead.length} OK, ${dead.length} broken\n`);

  if (dead.length) {
    console.log('BROKEN LINKS:');
    for (const r of dead) {
      console.log(`  [${r.source}] ${r.name}`);
      console.log(`    URL: ${r.url}`);
      console.log(`    Error: ${r.error || r.status}${r.redirect ? ` → ${r.redirect}` : ''}`);
      console.log();
    }
  }
}

main().catch(console.error);
