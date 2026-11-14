#!/usr/bin/env node
// Builds src/data/gift-guide.json for the /holiday-gifts page from
// hand-picked product IDs in products.json.
//
// Bull Moose picks must be shipping In Stock (av10/av11), not Special Order,
// and every image must load. Items that fail either check are dropped.
//
// Usage: node scripts/build-gift-guide.mjs

import { readFileSync, writeFileSync } from 'fs'

const SECTIONS = [
  {
    id: 'treats',
    title: 'Sweet Treats & Edible Gifts',
    blurb: 'Cheese boxes, chocolate, and holiday candy.',
    ids: [
      '104-7115790450745', '130-8633392922873', '113-9349214175561', '115-bc-608',
      '104-7113276063801', '130-8069128847609', '113-9537776320841', '115-bc-41',
      '130-8529157816569', '20-6678972498017', '128-10285535756607', '104-7126433333305',
      // backups
      '130-8810770497785', '113-9530495074633',
      '113-9535118967113',
    ],
  },
  {
    id: 'coffee',
    title: 'For the Coffee & Tea Lover',
    blurb: 'Coffee from worker co-op roasters, plus mugs and cocoa.',
    ids: [
      '1-155804799', '1-155769277', '1-155722413', '1-157134291',
      '146-9070806302939', '2-10212981932324', '145-8851457409186', '9-8749297434814',
      '146-8267645157595', '128-10562121105727', '3-wc-36682', '2-10212950180132',
      '113-10011828846921', '9-8366324089022',
      // backups
      '2-8433173102884',
      '146-8267645780187', '2-3990309666904',
    ],
  },
  {
    id: 'baking',
    title: 'For the Baker',
    blurb: 'Cookie cutters, mixes, and kitchen gear for holiday baking.',
    ids: [
      '115-bc-497', '115-bc-460', '15-microcosm-42067', '128-10285624197439',
      '115-bc-685', '115-bc-600', '176-bm-35293897', '115-bc-567',
      '176-bm-35293893', '115-bc-541',
      '115-bc-103', '115-bc-138',
      '115-bc-27', '115-bc-139',
    ],
  },
  {
    id: 'music',
    title: 'Holiday Vinyl',
    blurb: 'Christmas records from employee-owned record stores.',
    ids: [
      '176-bm-38822718', '176-bm-38086700', '176-bm-38884855', '176-bm-38884850',
      '177-zia-393930', '176-bm-38885183', '176-bm-38884524', '176-bm-38187386',
      '176-bm-38884848', '176-bm-1675606', '176-bm-38884856', '176-bm-38884857',
      // backups if the picks above aren't in stock
      '176-bm-34686415', '176-bm-36732996', '177-zia-17165694', '176-bm-38885184',
      '176-bm-38844830', '177-zia-14638779',
      '176-bm-38822724', '176-bm-13843292', '176-bm-35572014', '176-bm-35530208', '176-bm-38691865',
    ],
  },
  {
    id: 'books',
    title: 'For the Reader',
    blurb: 'Box sets, journals, and books from worker-owned publishers.',
    ids: [
      '176-bm-4812727', '176-bm-5366072', '176-bm-34483551', '128-10479873917247',
      '176-bm-1837666', '15-microcosm-11131', '176-bm-29915437', '176-bm-37912703',
      '15-microcosm-6598', '15-microcosm-58225', '15-microcosm-64058',
      // backups if the picks above aren't in stock
      '176-bm-9305936', '176-bm-36321163', '176-bm-38122980', '176-bm-16186639',
      '15-microcosm-55266', '15-microcosm-38112', '15-microcosm-30166', '128-10397282500927',
    ],
  },
  {
    id: 'games',
    title: 'Game Night',
    blurb: 'Board games from a worker co-op game studio, plus puzzles.',
    ids: [
      '28-5627428438166', '28-5646576287894', '176-bm-38100135', '176-bm-36291868',
      '28-5627428569238', '28-7361856995527', '176-bm-23713210', '176-bm-36361875',
      '176-bm-31819330', '176-bm-35577765',
      '28-5627428733078', '28-5627428077718', '176-bm-33129630',
    ],
  },
  {
    id: 'outdoors',
    title: 'For the Outdoorsy',
    blurb: 'Headlamps, tools, and winter gear from employee-owned Scheels.',
    ids: [
      '166-scheels-4678-E102AB00', '166-scheels-37447-831181', '166-scheels-4017-SW011493',
      '166-scheels-1486-NF0A88JQ', '166-scheels-645397-NEB-HLP-1005', '166-scheels-642249-8028',
      '166-scheels-812436-LP1513', '166-scheels-9947-61511619', '166-scheels-25725-52983C1',
      '166-scheels-729343-44158',
      '166-scheels-847706-502796', '166-scheels-13658-31-003566',
    ],
  },
  {
    id: 'cozy',
    title: 'Cozy Gifts',
    blurb: 'Slippers, socks, beanies, and sweatshirts.',
    ids: [
      '166-scheels-39161-41188-00267', '128-10479221932351', '166-scheels-1259-768',
      '3-wc-51740', '166-scheels-642249-6131', '9-8749293404350', '166-scheels-33977-1000229',
      '128-10479225995583', '166-scheels-4017-SW018120', '2-10265343230244',
      // backups
      '2-10265349751076',
      '9-8749299826878', '166-scheels-642249-6121',
      '128-10479222522175', '3-wc-52510',
    ],
  },
  {
    id: 'self-care',
    title: 'Self-Care',
    blurb: 'Soaps, bath salts, and spa gifts.',
    ids: [
      '133-9551282274601', '25-15636071186592', '25-15199683838112', '25-15318154772640',
      '26-8701289955505', '25-8253773217952', '128-10479876997439', '25-15685839224992',
      '167-bc-1502',
      // backups
      '150-7331205644355', '151-4395005509730', '150-7315127074883', '15-microcosm-67079', '128-10479876571455',
      '150-7315122716739', '151-7303205945442',
      '25-15740169846944', '150-7331199451203',
    ],
  },
  {
    id: 'handmade',
    title: 'Handmade & Decor',
    blurb: 'Ornaments, pottery, textiles, and jewelry from artisan co-ops and makers.',
    ids: [
      '41-cs-19728', '43-10280815657209', '128-10285490471231', '136-10598885851192',
      '41-cs-19537', '128-10285458751807', '43-10280815100153', '25-15758621016224',
      '41-cs-1470', '128-10285490209087', '41-cs-19514', '136-10575236825144',
      '41-cs-29722', '41-cs-1985',
      // backups
      '43-10317586071801', '41-cs-19641',
    ],
  },
  {
    id: 'stocking-stuffers',
    title: 'Stocking Stuffers',
    blurb: 'Small gifts, mostly under $15.',
    ids: [
      '113-9349214110025', '115-bc-160', '176-bm-26722141', '2-4639222693976',
      '128-10479876604223', '115-bc-276', '166-scheels-717153-557025', '9-8366327038142',
      '113-10010904789321', '2-8613540364580', '128-10285525139775', '166-scheels-19300-WH-BAR-LBJ-01',
    ],
  },
  {
    id: 'gift-cards',
    title: 'Last-Minute Gift Cards',
    blurb: 'Digital gift cards, no shipping needed.',
    ids: [
      '1-176164617',
      '115-bc-562', '152-7483833221181', '141-9085332095201', '2-4837275828312',
      '104-6951705542713', '146-8650067378395', '134-8357810569385', '119-1555206307895',
      '133-4756467646542', '143-8059460976960',
      '120-6917071896618', '129-4669056614490',
    ],
  },
]

const products = JSON.parse(readFileSync('public/data/products.json', 'utf8'))
const byId = new Map(products.map(p => [p.id, p]))

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Same shipping-status logic as check-bm-availability.mjs, but only av10/av11
// (In Stock) count. Special Order and pre-orders are dropped from the guide.
async function bullMooseInStock(productId) {
  try {
    const res = await fetch(`https://www.bullmoose.com/availabilitydetail/${productId}/0`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (!res.ok) return false
    const json = await res.json()
    const html = json.data?.data || ''
    const shipDivs = [...html.matchAll(/class="store-ship"[\s\S]*?<span class="av\s+([^"]+)"/g)]
    return shipDivs.some(m => /av10|av11/.test(m[1]))
  } catch {
    return false
  }
}

async function imageOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    return res.ok && (res.headers.get('content-type') || '').startsWith('image/')
  } catch {
    return false
  }
}

// Sections show at most this many items; extra IDs are backups
const MAX_PER_SECTION = 12

const out = []
for (const section of SECTIONS) {
  const items = []
  for (const id of section.ids) {
    if (items.length >= MAX_PER_SECTION) break
    const p = byId.get(id)
    if (!p) { console.log(`  MISSING ${section.id}: ${id}`); continue }
    if (p.available === false) { console.log(`  SOLD OUT ${section.id}: ${p.title}`); continue }
    if (p.store_name === 'Bull Moose') {
      const inStock = await bullMooseInStock(id.replace('176-bm-', ''))
      await sleep(300)
      if (!inStock) { console.log(`  NOT IN STOCK ${section.id}: ${p.title}`); continue }
    }
    if (!(await imageOk(p.image))) { console.log(`  BAD IMAGE ${section.id}: ${p.title}`); continue }
    items.push(p)
  }
  console.log(`${section.id}: ${items.length}`)
  const { ids, ...rest } = section
  out.push({ ...rest, products: items })
}

// Imported by HolidayGiftsPage so the products are in the prerendered HTML
writeFileSync('src/data/gift-guide.json', JSON.stringify(out, null, 2) + '\n')
console.log('Wrote src/data/gift-guide.json')
