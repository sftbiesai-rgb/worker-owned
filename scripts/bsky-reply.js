#!/usr/bin/env node
// Posts replies to specific Bluesky posts with clickable link facets.
// Usage: node scripts/bsky-reply.js
//
// Each reply object needs: url, text
// URLs in the text are auto-detected and made clickable.

const BSKY_HANDLE = 'iesai.bsky.social';
const BSKY_APP_PASSWORD = 'cRbdqFsy4M9GzmL';
const API = 'https://bsky.social/xrpc';

const REPLIES = [
  {
    url: 'https://bsky.app/profile/nome.bsky.social/post/3mwwgiyfifk2x',
    text: 'there are grocery stores already that run this way, but they\'re hard to find. we made a searchable marketplace with a food and pantry section https://www.workerowned.info/food-pantry before you get ur kim-chi (or beef patties or goetze caramels) at whole foods get it here :)',
  },
];

const SENT_LOG = 'scripts/.bsky-sent.json';
import fs from 'fs';

// CLI args
// --all         Send all unsent, spaced by --gap minutes (default 90)
// --gap 120     Minutes between replies (default 90)
// --next        Send only the next unsent reply, then exit
// --dry         Preview what would be sent without posting
// (no args)     Same as --next
const cliArgs = process.argv.slice(2);
const DRY_RUN = cliArgs.includes('--dry');
const SEND_ALL = cliArgs.includes('--all');
function getArg(name, fallback) {
  const idx = cliArgs.indexOf('--' + name);
  return idx >= 0 && cliArgs[idx + 1] ? Number(cliArgs[idx + 1]) : fallback;
}
const GAP_MINUTES = getArg('gap', 90);

function loadSent() {
  try { return JSON.parse(fs.readFileSync(SENT_LOG, 'utf8')); } catch { return []; }
}
function saveSent(sent) {
  fs.writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2) + '\n');
}

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
}

function parsePostUrl(url) {
  const parts = url.split('/');
  const rkey = parts.pop();
  const handle = parts[parts.length - 2];
  return { handle, rkey };
}

function buildFacets(text) {
  const urlRegex = /https?:\/\/[^\s,;!?).]+|workerowned\.info[^\s,;!?.)]*/g;
  const facets = [];
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const linkText = match[0];
    const linkUrl = linkText.startsWith('http') ? linkText : `https://${linkText}`;
    const charsBefore = text.slice(0, match.index);
    const byteStart = Buffer.from(charsBefore, 'utf8').length;
    const byteEnd = byteStart + Buffer.from(linkText, 'utf8').length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: linkUrl }],
    });
  }
  return facets;
}

async function resolvePost(url) {
  const { handle, rkey } = parsePostUrl(url);
  const didRes = await fetch(`${API}/com.atproto.identity.resolveHandle?handle=${handle}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const { did } = await didRes.json();
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
  const postRes = await fetch(`${API}/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const postData = await postRes.json();
  const post = postData.posts[0];
  return { uri: post.uri, cid: post.cid };
}

async function postReply(text, parentUri, parentCid) {
  const facets = buildFacets(text);
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    facets,
    createdAt: new Date().toISOString(),
    reply: {
      root: { uri: parentUri, cid: parentCid },
      parent: { uri: parentUri, cid: parentCid },
    },
  };

  const res = await fetch(API + '/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: authorDid, collection: 'app.bsky.feed.post', record }),
  });

  if (!res.ok) throw new Error(`Post failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const rkey = data.uri.split('/').pop();
  return `https://bsky.app/profile/iesai.bsky.social/post/${rkey}`;
}

function fmtWait(ms) {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`;
}

async function main() {
  if (REPLIES.length === 0) {
    console.log('No replies defined. Add entries to the REPLIES array.');
    process.exit(0);
  }

  const sent = new Set(loadSent());
  const unsent = REPLIES.filter(r => !sent.has(r.url));

  if (unsent.length === 0) {
    console.log('All replies already sent.');
    process.exit(0);
  }

  console.log(`${unsent.length} unsent of ${REPLIES.length} total (gap: ${GAP_MINUTES}m)\n`);

  if (DRY_RUN) {
    for (const [i, reply] of unsent.entries()) {
      console.log(`[${i + 1}] ${reply.url}`);
      console.log(`    ${reply.text.slice(0, 120)}...`);
      if (SEND_ALL && i < unsent.length - 1) console.log(`    ⏳ wait ${GAP_MINUTES}m`);
    }
    console.log('\n(dry run — nothing sent)');
    process.exit(0);
  }

  await authenticate();

  const toSend = SEND_ALL ? unsent : [unsent[0]];

  for (const [i, reply] of toSend.entries()) {
    const facets = buildFacets(reply.text);
    console.log(`Resolving: ${reply.url}`);
    console.log(`Links detected: ${facets.map(f => f.features[0].uri).join(', ') || 'none'}`);
    const { uri, cid } = await resolvePost(reply.url);
    const postedUrl = await postReply(reply.text, uri, cid);
    console.log(`Posted: ${postedUrl}`);
    console.log(`Text: ${reply.text}\n`);

    // Track sent
    sent.add(reply.url);
    saveSent([...sent]);

    // Wait between replies (skip after last one)
    if (SEND_ALL && i < toSend.length - 1) {
      const waitMs = GAP_MINUTES * 60 * 1000;
      console.log(`⏳ Waiting ${fmtWait(waitMs)} before next reply...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  const remaining = REPLIES.length - sent.size;
  console.log(`Done. ${remaining > 0 ? `${remaining} replies remaining — run again to continue.` : 'All replies sent!'}`);
}

main().catch(console.error);
