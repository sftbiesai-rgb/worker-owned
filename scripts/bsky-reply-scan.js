#!/usr/bin/env node
// Scans Bluesky for reply-to opportunities for workerowned.info.
//
// Two modes:
//   1. FEED MODE: Checks recent posts from target accounts for on-topic content
//   2. SEARCH MODE: Searches keywords for high-engagement posts from anyone
//
// Skips posts we've already replied to.
//
// Usage:
//   node scripts/bsky-reply-scan.js              # both modes, last 3 days
//   node scripts/bsky-reply-scan.js --days 7     # wider window
//   node scripts/bsky-reply-scan.js --min 50     # lower like threshold for search mode
//   node scripts/bsky-reply-scan.js --feeds-only # only check target account feeds
//   node scripts/bsky-reply-scan.js --search-only # only do keyword search

const BSKY_HANDLE = 'iesai.bsky.social';
const BSKY_APP_PASSWORD = 'cRbdqFsy4M9GzmL';
const API = 'https://bsky.social/xrpc';

// Parse args
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? Number(args[idx + 1]) : fallback;
}
const MAX_DAYS = getArg('days', 3);
const MIN_LIKES = getArg('min', 100);
const FEEDS_ONLY = args.includes('--feeds-only');
const SEARCH_ONLY = args.includes('--search-only');

// ─── TARGET ACCOUNTS ───
// High-reach accounts in the co-op / labor / anti-monopoly / ethical economy space.
// We monitor their feeds for on-topic posts to reply to.
const TARGET_ACCOUNTS = [
  // Anti-monopoly / progressive economics
  { handle: 'mattstoller.bsky.social', note: 'BIG newsletter, anti-monopoly' },
  { handle: 'stacyfmitchell.bsky.social', note: 'ILSR, anti-Amazon, local biz' },
  { handle: 'ddayen.bsky.social', note: 'The American Prospect, monopoly/finance' },
  { handle: 'openmarkets.bsky.social', note: 'Open Markets Institute' },
  { handle: 'ilsr.bsky.social', note: 'Institute for Local Self-Reliance' },
  // Labor / unions / worker power
  { handle: 'moreperfectunion.bsky.social', note: 'labor media, big reach' },
  { handle: 'rwdsu.bsky.social', note: 'Retail Workers union' },
  { handle: 'aflcio.bsky.social', note: 'AFL-CIO' },
  // Progressive media / journalists
  { handle: 'doctorow.pluralistic.net', note: 'Cory Doctorow, already featured us on Pluralistic' },
  { handle: 'currentaffairs.bsky.social', note: 'Current Affairs magazine' },
  { handle: 'jacobin.bsky.social', note: 'Jacobin magazine' },
  { handle: 'thenation.bsky.social', note: 'The Nation' },
  { handle: 'theintercept.bsky.social', note: 'The Intercept' },
  { handle: 'motherjones.bsky.social', note: 'Mother Jones' },
  { handle: 'propublica.bsky.social', note: 'ProPublica' },
  { handle: 'prospect.bsky.social', note: 'The American Prospect' },
  { handle: 'commondreams.bsky.social', note: 'Common Dreams' },
  { handle: 'democracynow.bsky.social', note: 'Democracy Now' },
  { handle: 'truthout.bsky.social', note: 'Truthout' },
  // Cooperative ecosystem
  { handle: 'cooperatives.bsky.social', note: 'The Cooperative Economy (28K)' },
  { handle: 'usworker.coop', note: 'USFWC' },
  // Tech / platform critics
  { handle: 'eff.bsky.social', note: 'EFF' },
  { handle: 'fightforthefuture.bsky.social', note: 'Fight for the Future' },
  // Influencers from our DM outreach (couldn't DM, so reply instead)
  { handle: 'profgalloway.com', note: 'Scott Galloway (239K)' },
  { handle: 'anamariecox.com', note: 'Ana Marie Cox (162K)' },
  { handle: 'publiccitizen.bsky.social', note: 'Public Citizen (70K)' },
  { handle: 'workingfamilies.org', note: 'Working Families Party (55K)' },
  { handle: 'therealnews.com', note: 'The Real News Network (39K)' },
  { handle: 'laurenkaorigurley.bsky.social', note: 'Lauren Kaori Gurley, labor reporter (13K)' },
  { handle: 'cwaunion.bsky.social', note: 'CWA union (9K)' },
  { handle: 'secondwindgroup.com', note: 'Second Wind gaming co-op (80K)' },
  { handle: '51st.news', note: 'The 51st, worker-owned news' },
  { handle: '404media.co', note: '404 Media' },
  { handle: 'defector.com', note: 'Defector, worker-owned sports/culture' },
  { handle: 'hellgatenyc.com', note: 'Hell Gate, worker-owned NYC news' },
];

// Keywords that suggest a post is relevant for a workerowned.info reply
const ON_TOPIC_KEYWORDS = [
  'worker.own', 'worker.co.op', 'worker co-op', 'cooperative', 'co-op',
  'employee.own', 'esop',
  'buy local', 'shop local', 'support local',
  'ethical shopping', 'ethical consumer', 'conscious consumer',
  'alternative to amazon', 'quit amazon', 'amazon alternative',
  'corporate greed', 'billionaire',
  'labor', 'union', 'workers right',
  'economic democracy', 'solidarity economy',
  'platform cooperativ', 'gig worker',
  'mondragon', 'cooperative business',
  'small business', 'independent business',
  'anti.monopoly', 'antitrust',
  'where can i buy', 'where to buy', 'looking for',
  'support worker', 'worker power',
];

// ─── SEARCH QUERIES ───
// Broader keyword searches for high-engagement posts from anyone
const SEARCH_QUERIES = [
  'worker cooperative',
  'worker owned business',
  'employee owned',
  'cooperative economy',
  'buy worker owned',
  'shop cooperative',
  'support worker owned',
  'alternative to amazon',
  'ethical shopping worker',
  'worker co-op',
  'economic democracy',
  'solidarity economy',
  'platform cooperativism',
  'cooperative business',
  'worker ownership',
];

let authToken = null;
let authorDid = null;

async function authenticate() {
  const res = await fetch(API + '/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: BSKY_HANDLE, password: BSKY_APP_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  authToken = data.accessJwt;
  authorDid = data.did;
  console.log(`Authenticated as @${data.handle}\n`);
  return data.did;
}

async function getOurRepliedUrls(did) {
  const res = await fetch(
    `${API}/app.bsky.feed.getAuthorFeed?actor=${did}&limit=100&filter=posts_with_replies`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  const data = await res.json();
  const urls = new Set();
  for (const item of (data.feed || [])) {
    if (item.reply && item.reply.parent) {
      const parentUri = item.reply.parent.uri;
      const parentHandle = item.reply.parent.author?.handle;
      const rkey = parentUri.split('/').pop();
      urls.add(`https://bsky.app/profile/${parentHandle}/post/${rkey}`);
    }
  }
  return urls;
}

function isOnTopic(text) {
  const lower = text.toLowerCase();
  return ON_TOPIC_KEYWORDS.some(kw => {
    // Handle regex-style dots as word boundaries
    const pattern = kw.replace(/\./g, '[\\s\\-_.]?');
    return new RegExp(pattern, 'i').test(lower);
  });
}

function postUrl(handle, uri) {
  const rkey = uri.split('/').pop();
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function truncate(text, len = 200) {
  text = text.replace(/\n/g, ' ');
  return text.length > len ? text.slice(0, len) + '...' : text;
}

function ageStr(date) {
  const hours = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function fmtFollowers(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
}

// ─── FEED MODE: check target accounts for on-topic posts ───
async function scanFeeds(cutoff) {
  console.log(`Checking ${TARGET_ACCOUNTS.length} target account feeds...\n`);
  const results = [];

  for (const target of TARGET_ACCOUNTS) {
    try {
      const res = await fetch(
        `${API}/app.bsky.feed.getAuthorFeed?actor=${target.handle}&limit=30&filter=posts_no_replies`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!res.ok) continue;
      const data = await res.json();

      for (const item of (data.feed || [])) {
        const post = item.post;
        const text = post.record?.text || '';
        const created = new Date(post.record?.createdAt);
        if (created < cutoff) continue;
        if (!isOnTopic(text)) continue;

        const likes = post.likeCount || 0;
        const followers = post.author?.followersCount || 0;
        const url = postUrl(post.author.handle, post.uri);
        results.push({
          mode: 'feed',
          handle: post.author.handle,
          note: target.note,
          likes,
          reposts: post.repostCount || 0,
          replies: post.replyCount || 0,
          followers,
          url,
          text,
          created,
        });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

// ─── SEARCH MODE: keyword search for high-engagement posts ───
async function scanSearch(cutoff) {
  console.log(`Searching ${SEARCH_QUERIES.length} keyword queries...\n`);
  const results = [];

  for (const q of SEARCH_QUERIES) {
    try {
      const res = await fetch(
        `${API}/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&limit=25`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!res.ok) continue;
      const data = await res.json();

      for (const post of (data.posts || [])) {
        const created = new Date(post.record?.createdAt);
        if (created < cutoff) continue;
        const likes = post.likeCount || 0;
        const followers = post.author?.followersCount || 0;
        if (likes < MIN_LIKES && followers < 5000) continue;

        const url = postUrl(post.author.handle, post.uri);
        const text = post.record?.text || '';
        results.push({
          mode: 'search',
          query: q,
          handle: post.author.handle,
          note: '',
          likes,
          reposts: post.repostCount || 0,
          replies: post.replyCount || 0,
          followers,
          url,
          text,
          created,
        });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

async function main() {
  const did = await authenticate();
  const repliedUrls = await getOurRepliedUrls(did);
  console.log(`Already replied to ${repliedUrls.size} posts`);

  const cutoff = new Date(Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000);
  console.log(`Window: last ${MAX_DAYS} days (since ${cutoff.toISOString().slice(0, 10)})\n`);

  let all = [];

  if (!SEARCH_ONLY) {
    const feedResults = await scanFeeds(cutoff);
    all.push(...feedResults);
  }

  if (!FEEDS_ONLY) {
    const searchResults = await scanSearch(cutoff);
    all.push(...searchResults);
  }

  // Dedupe by URL
  const seen = new Set();
  const unique = all.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const fresh = unique.filter(r => !repliedUrls.has(r.url));
  const replied = unique.filter(r => repliedUrls.has(r.url));

  // Sort: feed hits first (targeted), then search hits by likes
  fresh.sort((a, b) => {
    if (a.mode !== b.mode) return a.mode === 'feed' ? -1 : 1;
    return b.likes - a.likes || b.followers - a.followers;
  });

  // Print
  if (fresh.length === 0) {
    console.log('No new reply opportunities found.\n');
  } else {
    const feedHits = fresh.filter(r => r.mode === 'feed');
    const searchHits = fresh.filter(r => r.mode === 'search');

    if (feedHits.length > 0) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`  TARGET ACCOUNT POSTS (${feedHits.length}) — on-topic posts from monitored accounts`);
      console.log(`${'═'.repeat(70)}\n`);
      for (const r of feedHits) {
        console.log(`  ♥ ${r.likes.toLocaleString()} likes | ${fmtFollowers(r.followers)} followers | ${ageStr(r.created)}`);
        console.log(`  @${r.handle} — ${r.note}`);
        console.log(`  ${r.url}`);
        console.log(`  "${truncate(r.text)}"`);
        console.log('');
      }
    }

    if (searchHits.length > 0) {
      console.log(`${'═'.repeat(70)}`);
      console.log(`  KEYWORD SEARCH HITS (${searchHits.length}) — high-engagement posts from anyone`);
      console.log(`${'═'.repeat(70)}\n`);
      for (const r of searchHits) {
        console.log(`  ♥ ${r.likes.toLocaleString()} likes | ${fmtFollowers(r.followers)} followers | ${ageStr(r.created)} | q: "${r.query}"`);
        console.log(`  @${r.handle}`);
        console.log(`  ${r.url}`);
        console.log(`  "${truncate(r.text)}"`);
        console.log('');
      }
    }
  }

  if (replied.length > 0) {
    console.log(`─── Already replied (${replied.length}) ───`);
    for (const r of replied) {
      console.log(`  @${r.handle} (${r.likes.toLocaleString()} likes) ${r.url}`);
    }
    console.log('');
  }

  console.log(`Summary: ${fresh.length} opportunities (${fresh.filter(r => r.mode === 'feed').length} from feeds, ${fresh.filter(r => r.mode === 'search').length} from search), ${replied.length} already replied.`);
}

main().catch(console.error);
