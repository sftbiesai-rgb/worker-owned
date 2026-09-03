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
    // 404 Media — 3-year milestone (116 likes)
    url: 'https://bsky.app/profile/josephcox.bsky.social/post/3mu37r5q55c2x',
    text: "Booya, three years! 404 Media is one of the best examples of what worker ownership in journalism looks like. You're listed on workerowned.info alongside other worker-owned outlets like Defector, Hell Gate, and The 51st.",
  },
  {
    // USFWC — Mayday salon co-op (3 likes)
    url: 'https://bsky.app/profile/usworker.coop/post/3mu6cee7gxs2h',
    text: "Love seeing co-ops in industries you don't usually expect. We have 170+ worker-owned businesses listed at workerowned.info — would be great to get more salons and service co-ops represented.",
  },
  {
    // More Perfect Union — Starbucks boycott (5,197 likes)
    url: 'https://bsky.app/profile/moreperfectunion.bsky.social/post/3mtwagg56c22i',
    text: "If you're looking for where to get your coffee instead, workerowned.info has a directory of worker-owned businesses including coffee roasters and cafes. Companies where the workers already have a fair contract because they own the place.",
  },
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

async function main() {
  if (REPLIES.length === 0) {
    console.log('No replies defined. Add entries to the REPLIES array.');
    process.exit(0);
  }

  await authenticate();

  for (const reply of REPLIES) {
    const facets = buildFacets(reply.text);
    console.log(`Resolving: ${reply.url}`);
    console.log(`Links detected: ${facets.map(f => f.features[0].uri).join(', ') || 'none'}`);
    const { uri, cid } = await resolvePost(reply.url);
    const postedUrl = await postReply(reply.text, uri, cid);
    console.log(`Posted: ${postedUrl}`);
    console.log(`Text: ${reply.text}\n`);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('Done.');
}

main().catch(console.error);
