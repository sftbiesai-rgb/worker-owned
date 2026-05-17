#!/usr/bin/env node

const API_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const BATCH_SIZE = 10;
const MODEL = 'openai/gpt-4o-mini-search-preview';

const CITY_DATA = `
New York[c]	NY
Los Angeles	CA
Chicago	IL
Houston	TX
Phoenix	AZ
Philadelphia[d]	PA
San Antonio	TX
San Diego	CA
Dallas	TX
Fort Worth	TX
Jacksonville[e]	FL
Austin	TX
San Jose	CA
Charlotte	NC
Columbus	OH
Indianapolis[f]	IN
San Francisco[g]	CA
Seattle	WA
Denver[h]	CO
Nashville[i]	TN
Oklahoma City	OK
Washington[j]	DC
El Paso	TX
Las Vegas	NV
Boston	MA
Detroit	MI
Louisville[k]	KY
Portland	OR
Memphis	TN
Baltimore[l]	MD
Milwaukee	WI
Albuquerque	NM
Fresno	CA
Tucson	AZ
Sacramento	CA
Atlanta	GA
Kansas City	MO
Mesa	AZ
Raleigh	NC
Colorado Springs	CO
Miami	FL
Omaha	NE
Virginia Beach[l]	VA
Long Beach	CA
Oakland	CA
Minneapolis	MN
Bakersfield	CA
Tulsa	OK
Tampa	FL
Aurora	CO
Arlington	TX
Wichita	KS
Cleveland	OH
New Orleans[m]	LA
Henderson	NV
Honolulu[n]	HI
Anaheim	CA
Orlando	FL
Lexington[o]	KY
Stockton	CA
Newark	NJ
Riverside	CA
Irvine	CA
Corpus Christi	TX
Santa Ana	CA
Cincinnati	OH
Greensboro	NC
Pittsburgh	PA
Saint Paul	MN
Durham	NC
Jersey City	NJ
Lincoln	NE
North Las Vegas	NV
Plano	TX
Gilbert	AZ
Anchorage[p]	AK
Madison	WI
Reno	NV
Chandler	AZ
St. Louis[l]	MO
Chula Vista	CA
Fort Wayne	IN
Buffalo	NY
Lubbock	TX
Laredo	TX
Port St. Lucie	FL
St. Petersburg	FL
Toledo	OH
Glendale	AZ
Winston-Salem	NC
Irving	TX
Chesapeake[l]	VA
Garland	TX
Scottsdale	AZ
Boise[q]	ID
Richmond[l]	VA
Frisco	TX
Cape Coral	FL
McKinney	TX
Huntsville	AL
Norfolk[l]	VA
Hialeah	FL
Spokane	WA
Tacoma	WA
Santa Clarita	CA
Fremont	CA
Baton Rouge[r]	LA
San Bernardino	CA
Fontana	CA
Modesto	CA
Salt Lake City	UT
Moreno Valley	CA
Worcester	MA
Sioux Falls	SD
Yonkers	NY
Des Moines	IA
Grand Prairie	TX
Fayetteville	NC
Little Rock	AR
Rochester	NY
Amarillo	TX
Tallahassee	FL
Overland Park	KS
Columbus[s]	GA
Knoxville	TN
Augusta[t]	GA
Grand Rapids	MI
Peoria	AZ
Mobile	AL
Vancouver	WA
Oxnard	CA
Birmingham	AL
Providence	RI
Montgomery	AL
Chattanooga	TN
Brownsville	TX
Huntington Beach	CA
Tempe	AZ
Akron	OH
Clarksville	TN
Fort Lauderdale	FL
Glendale	CA
Ontario	CA
Elk Grove	CA
Cary	NC
Newport News[l]	VA
Salem	OR
Aurora	IL
Santa Rosa	CA
Eugene	OR
Rancho Cucamonga	CA
Pembroke Pines	FL
Shreveport	LA
Surprise	AZ
Fort Collins	CO
Murfreesboro	TN
Oceanside	CA
Garden Grove	CA
Lancaster	CA
Springfield	MO
Denton	TX
Roseville	CA
Killeen	TX
Palmdale	CA
Paterson	NJ
Corona	CA
Alexandria[l]	VA
Charleston	SC
Salinas	CA
Kansas City[u]	KS
Macon[v]	GA
Hayward	CA
Hollywood	FL
Lakewood	CO
Sunnyvale	CA
Springfield	MA
Bellevue	WA
Naperville	IL
Bridgeport	CT
Joliet	IL
Mesquite	TX
McAllen	TX
Olathe	KS
Savannah	GA
Gainesville	FL
Pasadena	TX
Palm Bay	FL
Pomona	CA
Waco	TX
Thornton	CO
Midland	TX
Rockford	IL
Columbia	SC
Visalia	CA
Escondido	CA
Syracuse	NY
Lakewood[w]	NJ
Meridian	ID
Miramar	FL
Elizabeth	NJ
`;

function parseCities(raw) {
  return raw.trim().split('\n').map(line => {
    const parts = line.trim().split('\t');
    if (parts.length < 2) return null;
    const rawCity = parts[0].trim();
    const state = parts[1].trim();
    const city = rawCity.replace(/\[.*?\]/g, '').trim();
    return { city, state };
  }).filter(Boolean);
}

function batches(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function searchBatch(batch, apiKey, batchIdx, total) {
  const cityList = batch.map(c => `${c.city}, ${c.state}`).join('\n');
  const systemPrompt = `You are a research assistant building a directory of worker-owned coffee shops and restaurants in US cities. For each city in the list, search the web for worker-owned/worker-cooperative coffee shops and restaurants. Return ALL results you find as a JSON array.

For each business found, output:
{
  "name": "Business Name",
  "city": "City",
  "state": "ST",
  "location": "Full address if found, or empty string",
  "website": "website URL or empty string",
  "category": "coffee" or "restaurant"
}

Search for both "worker owned coffee shop" and "worker owned restaurant" (and variations like "worker cooperative cafe", "employee-owned cafe") for each city. Only include businesses that are genuinely worker-owned cooperatives, not just "employee-friendly" or ESOPs. If you find no results for a city, skip it. Output valid JSON array only, no explanation.`;

  const userPrompt = `Search for worker-owned coffee shops and worker-owned restaurants in these cities:\n\n${cityList}`;

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    web_search: { search_context_size: 'medium' },
  };

  console.error(`[${batchIdx + 1}/${total}] Searching ${batch.length} cities with ${MODEL}...`);
  const start = Date.now();

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
  let content = data.choices?.[0]?.message?.content || '[]';

  const usage = data.usage || {};
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`[${batchIdx + 1}/${total}] Done in ${elapsed}s. Tokens: ${usage.prompt_tokens || '?'} in / ${usage.completion_tokens || '?'} out`);

  // Try to parse JSON from the response (it might be wrapped in markdown code blocks)
  const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (jsonMatch) {
    content = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(content);
  } catch {
    console.error(`Warning: Could not parse JSON from batch ${batchIdx + 1}. Raw output:`);
    console.error(content.slice(0, 500));
    return [];
  }
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  const cities = parseCities(CITY_DATA);
  console.error(`Parsed ${cities.length} cities`);

  const batched = batches(cities, BATCH_SIZE);
  console.error(`Processing in ${batched.length} batches of up to ${BATCH_SIZE}...\n`);

  let allResults = [];
  let idCounter = 1;

  for (let i = 0; i < batched.length; i++) {
    const results = await searchBatch(batched[i], apiKey, i, batched.length);
    if (Array.isArray(results)) {
      const withIds = results.map(r => ({ id: idCounter++, ...r }));
      allResults = allResults.concat(withIds);
    }
    // Small delay between batches
    if (i < batched.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(JSON.stringify(allResults, null, 2));
  console.error(`\nTotal: ${allResults.length} businesses found across ${cities.length} cities`);
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
