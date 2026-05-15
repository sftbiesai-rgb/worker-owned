#!/usr/bin/env node

/**
 * OpenRouter Multi-Model Pipeline
 * Routes each database expansion task to the cheapest model that can execute it.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-xxx node scripts/or-pipeline.mjs <task-id> [input...]
 *
 *   Provide input as CLI args, pipe via stdin, or use --input-file <path>.
 *   If input is a file path, it will be read automatically.
 *
 * Examples:
 *   node scripts/or-pipeline.mjs 1 < raw-directory-page.txt
 *   node scripts/or-pipeline.mjs 2 "Austin, TX" "Chicago, IL"
 *   node scripts/or-pipeline.mjs 3 "worker owned coffee shop portland"
 *   node scripts/or-pipeline.mjs 5 "Blue Bottle Coffee is owned by Nestle..."
 *   node scripts/or-pipeline.mjs 8 '{"name":"Joe's Cafe","city":"Portland"}' --incomplete
 *   node scripts/or-pipeline.mjs 9 < usfwc-entries.json
 */

const API_BASE = 'https://openrouter.ai/api/v1/chat/completions';

// ─── Task definitions ──────────────────────────────────────────────────────
const TASKS = {
  '1': {
    name: 'Scraping regional directories',
    model: 'mistralai/mistral-nemo',
    canExecute: false,
    description: 'Human must paste raw page text via stdin. Model extracts structured JSON entries.',
    system: `You are a data extraction assistant. Given raw text from a worker co-op directory page, extract each business entry as JSON with fields: name, city, state, website, category (coffee/restaurant/unknown). Output a JSON array only, no explanation.`,
    user: (input) => `Extract worker co-op business entries from this page text:\n\n${input}`,
  },
  '2': {
    name: 'City-specific search queries',
    model: 'openrouter/auto',
    canExecute: false,
    description: 'Generates search query strings for a human to paste into Google. Provide city names as arguments.',
    system: `You generate targeted Google search queries for finding worker-owned coffee shops and restaurants in specific cities. Output a markdown list of 5-8 search queries per city.`,
    user: (input) => `Generate search queries to find worker-owned coffee shops and restaurants in these cities:\n\n${input}`,
  },
  '3': {
    name: 'News article discovery & analysis',
    model: 'openai/gpt-4o-mini-search-preview',
    canExecute: true,
    description: 'Searches the web for co-op conversion news articles and extracts business info. Provide a search query.',
    system: `Search the web for news about worker cooperative conversions in food businesses. For each article you find, extract: business name, city, state, article URL, summary, and whether it's coffee/restaurant. Output a JSON array.`,
    user: (input) => `Search for recent news about worker cooperative conversions. Query: ${input}`,
    extraBody: { web_search: { search_context_size: 'medium' } },
  },
  '4': {
    name: 'Co-op ecosystem site analysis',
    model: 'deepseek/deepseek-v4-flash',
    canExecute: false,
    description: 'Human must paste text from Yelp/LinkedIn/Google Maps. Model extracts structured entries.',
    system: `You are a data extraction assistant. Given text copy-pasted from review sites or business directories, extract each business entry as JSON with fields: name, city, state, description, source. Output a JSON array only.`,
    user: (input) => `Extract worker-owned businesses from this content:\n\n${input}`,
  },
  '5': {
    name: 'ESOP vs Worker Co-op verification',
    model: 'openai/gpt-4o-mini',
    canExecute: true,
    description: 'Classifies a business as worker co-op, ESOP, or neither. Provide a business description or website text.',
    system: `You classify business ownership structures. Given a business description, determine: "worker_coop" (one worker one vote, democratic), "esop" (employee stock ownership plan, indirect), "neither", or "uncertain". Output JSON: {"classification": "...", "confidence": 0.0-1.0, "reasoning": "..."}.`,
    user: (input) => `Classify this business:\n\n${input}`,
  },
  '6': {
    name: 'State-by-state systematic search',
    model: 'openrouter/auto',
    canExecute: false,
    description: 'Generates a markdown search strategy for all 50 states for a human to execute.',
    system: `You are a research strategist. Generate a systematic state-by-state search plan for finding worker-owned food businesses. For each state, provide: search queries to use, relevant co-op development organizations, and government resources to check. Output as markdown.`,
    user: () => 'Generate a systematic state-by-state search strategy for finding worker-owned coffee shops and restaurants across all 50 US states.',
  },
  '7': {
    name: 'Crowdsource promotion content',
    model: 'google/gemini-2.0-flash-lite-001',
    canExecute: true,
    description: 'Writes promotional copy for Reddit, Slack, mailing lists. Provide platform and context.',
    system: `You write engaging promotional copy for crowdsourcing submissions to a worker-owned business directory. Adapt tone per platform: Reddit (casual, community-focused), Slack (professional but warm), mailing lists (formal, informative). Keep posts under 300 words. Include the URL and a clear call to action.`,
    user: (input) => `Write a promotion post for this platform and context:\n\n${input}`,
  },
  '8': {
    name: 'Data entry / JSON formatting',
    model: 'mistralai/mistral-nemo',
    canExecute: true,
    description: 'Converts unstructured business info into JSON matching the shops.json schema. Pipe input or provide as text.',
    system: `You format business data into JSON. Output ONLY a valid JSON object matching this schema: {"id": number, "name": string, "city": string, "state": string, "location": string, "website": string, "category": "coffee"|"restaurant"}. If given an array of entries, output a JSON array.`,
    user: (input) => `Format this business info as JSON:\n\n${input}`,
  },
'9': {
    name: 'Multi-sector classification',
    model: 'deepseek/deepseek-v4-flash',
    canExecute: true,
    description: 'Classifies 474+ USFWC entries into 8 business sectors. Provide the list as JSON.',
    system: `You classify worker-owned businesses into sectors. Sectors: clothing_apparel, bookstores, home_garden, healthcare_wellness, childcare_education, retail_grocery, tech_media, manufacturing_trades, food_beverage, unknown. Given a JSON array of businesses with name and description, return the same array with a "sector" field added to each. Output JSON only.`,
    user: (input) => `Classify these businesses into sectors:\n\n${input}`,
  },
  '10': {
    name: 'QC / Data quality check',
    model: 'deepseek/deepseek-v4-flash',
    canExecute: true,
    description: 'Validates a JSON array of candidate entries for data quality issues. Pipe entries JSON via stdin.',
    system: `You are a data quality auditor for a worker-owned business directory. Given a JSON array of business entries, check each for:
- Missing or empty fields (name, city, state, website, category)
- Invalid state abbreviations (should be 2-letter USPS codes)
- Invalid category (must be "coffee" or "restaurant")
- Website that looks malformed (missing domain, random text instead of URL)
- City name that looks wrong (has state embedded, non-US city, typos)
- Duplicate entries (same name + city + state)

Output a JSON object with:
{
  "total_entries": number,
  "passed": number,
  "flagged": [{ "index": number, "name": string, "issues": [string] }],
  "clean_entries": [the original entries that passed, with QC timestamp]
}`,
    user: (input) => `QC these entries:\n\n${input}`,
  },
  '11': {
    name: 'Website & business status verification',
    model: null, // hybrid: code checks URLs, then LLM analyzes page content
    canExecute: true,
    description: 'Checks each entry\'s website URL resolves (HTTP 200), then fetches the page and uses an LLM to check if the business appears to be open. Pipe entries JSON via stdin.',
    system: null,
    user: null,
  },
};

// ─── Task 11: Website verification (hybrid: code + LLM) ──────────────────
async function task11VerifyWebsites(entries, apiKey) {
  const results = [];

  console.error(`\n🔍 Checking ${entries.length} websites...`);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const url = entry.website ? entry.website.trim() : '';

    if (!url) {
      results.push({ index: i, name: entry.name, url: null, status: 'NO_URL', httpStatus: null, pageSnippet: '' });
      console.error(`  [${i + 1}/${entries.length}] ${entry.name} — no URL`);
      continue;
    }

    // Normalize URL
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(fullUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkerOwnedDir/1.0)' },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      let snippet = '';
      if (resp.ok) {
        const text = await resp.text();
        // Extract first 2000 chars of meaningful text
        snippet = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
                      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .slice(0, 2000);
      }

      results.push({
        index: i,
        name: entry.name,
        url: fullUrl,
        status: resp.ok ? 'REACHABLE' : `HTTP_${resp.status}`,
        httpStatus: resp.status,
        pageSnippet: snippet,
      });

      console.error(`  [${i + 1}/${entries.length}] ${entry.name} — ${resp.status}${resp.ok ? '' : ' FAIL'}`);
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'TIMEOUT' : 'ERROR';
      results.push({
        index: i, name: entry.name, url: fullUrl,
        status: reason, httpStatus: null, pageSnippet: '',
      });
      console.error(`  [${i + 1}/${entries.length}] ${entry.name} — ${reason}`);
    }

    // Delay between requests to be polite
    await new Promise(r => setTimeout(r, 500));
  }

  // Send results to LLM for final analysis
  console.error(`\n📡 Analyzing results with deepseek/deepseek-v4-flash...`);

  const systemPrompt = `You are verifying entries for a worker-owned business directory. Given HTTP check results and page snippets for each entry, determine:
- "open": page loads and shows no signs of closure
- "closed": page clearly states permanently closed, business not found
- "uncertain": can't determine (ambiguous page, generic placeholder, etc.)

Output a JSON array with objects: { index, name, verdict: "open"|"closed"|"uncertain", confidence: 0.0-1.0, evidence: "brief reason" }`;

  const userPrompt = `Analyze these website verification results and determine if each business is still open:\n\n${JSON.stringify(results, null, 2)}`;

  const body = {
    model: 'deepseek/deepseek-v4-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM analysis error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Help ──────────────────────────────────────────────────────────────────
function showHelp() {
  console.log(`OpenRouter Multi-Model Pipeline

Usage:
  OPENROUTER_API_KEY=sk-xxx node scripts/or-pipeline.mjs <task-id> [input...]

  Input sources (checked in order):
    1. --input-file <path>    Read input from a file
    2. <arg1> <arg2> ...      Use CLI arguments as input
    3. (stdin)                Pipe input via stdin

Tasks:
`);
  for (const [id, t] of Object.entries(TASKS)) {
    const exec = t.canExecute ? 'EXECUTES' : 'PLAN ONLY';
    const model = t.model || 'hybrid (code + LLM)';
    console.log(`  ${id}. ${t.name}`);
    console.log(`     Model: ${model}  [${exec}]`);
    console.log(`     ${t.description}`);
    console.log();
  }
process.exit(0);
}

// ─── Input handling ────────────────────────────────────────────────────────
async function getInput(taskArgs) {
  const fileIdx = taskArgs.indexOf('--input-file');
  if (fileIdx !== -1 && taskArgs[fileIdx + 1]) {
    const fs = await import('fs');
    return fs.readFileSync(taskArgs[fileIdx + 1], 'utf-8');
  }
  if (taskArgs.length > 0) {
    return taskArgs.join('\n');
  }
  // Try stdin
  const fs = await import('fs');
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
  return '';
}

// ─── OpenRouter call ──────────────────────────────────────────────────────
async function callModel(task, input, apiKey) {
  const messages = [{ role: 'system', content: task.system }];
  if (input) {
    const userContent = typeof task.user === 'function' ? task.user(input) : input;
    messages.push({ role: 'user', content: userContent });
  }

  const body = {
    model: task.model,
    messages,
    ...(task.extraBody || {}),
  };

  console.error(`\n📡 Calling ${task.model}...`);
  if (!task.canExecute) {
    console.error(`⚠️  This task cannot be fully executed by the model. It generates a plan for a human to follow.`);
  }

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const output = data.choices?.[0]?.message?.content || '';
  const usage = data.usage || {};

  console.error(`✅ Done. Tokens: ${usage.prompt_tokens || '?'} in / ${usage.completion_tokens || '?'} out`);
  return output;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
  }

  const taskId = args[0];
  const task = TASKS[taskId];
  if (!task) {
    console.error(`Unknown task "${taskId}". Valid tasks: ${Object.keys(TASKS).join(', ')}`);
    process.exit(1);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  // Rest of args after task-id are task arguments
  const taskArgs = args.slice(1);
  const input = await getInput(taskArgs);

  try {
    if (taskId === '11') {
      // Hybrid task: code checks URLs, then LLM analyzes content
      const entries = JSON.parse(input);
      if (!Array.isArray(entries)) {
        throw new Error('Task 11 requires a JSON array of entries as input');
      }
      const output = await task11VerifyWebsites(entries, apiKey);
      console.log(output);
    } else {
      const output = await callModel(task, input, apiKey);
      console.log(output);
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();