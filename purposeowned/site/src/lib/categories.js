// Purpose Owned – 8 product categories
// Each maps one or more B Corp industry values → a single category slug/label

export const CATEGORIES = [
  {
    slug: 'food-pantry',
    label: 'Food & Pantry',
    industries: ['Food & Pantry'],
  },
  {
    slug: 'apparel',
    label: 'Apparel',
    industries: ['Apparel'],
  },
  {
    slug: 'personal-care',
    label: 'Personal Care',
    industries: ['Personal Care'],
  },
  {
    slug: 'home-goods',
    label: 'Home Goods',
    industries: ['Home Goods'],
  },
  {
    slug: 'sporting-goods',
    label: 'Sporting Goods',
    industries: ['Sporting Goods'],
  },
  {
    slug: 'furniture',
    label: 'Furniture',
    industries: ['Furniture'],
  },
  {
    slug: 'textiles-rugs',
    label: 'Textiles & Rugs',
    industries: ['Textiles & Rugs'],
  },
  {
    slug: 'jewelry',
    label: 'Jewelry',
    industries: ['Jewelry'],
  },
  {
    slug: 'other',
    label: 'Other',
    industries: ['Other'],
  },
]

// Map an industry string (from search.json store.i) → category slug
export const INDUSTRY_TO_SLUG = Object.fromEntries(
  CATEGORIES.flatMap(c => c.industries.map(ind => [ind, c.slug]))
)

// Map an industry string → category object
export function categoryForIndustry(industry) {
  const slug = INDUSTRY_TO_SLUG[industry]
  return slug ? CATEGORIES.find(c => c.slug === slug) : null
}

// Find category by slug
export function categoryBySlug(slug) {
  return CATEGORIES.find(c => c.slug === slug) || null
}

// Product-level category. Stores are filed under one industry, but many sell
// across categories (Grove's shampoo isn't Home Goods, a boutique's necklaces
// are Jewelry). When the item a title names (its last real word) clearly
// belongs to a category, use that; otherwise keep the store's industry.
const HEAD_CATEGORY = {}
const addHeads = (industry, words) => words.forEach(w => { HEAD_CATEGORY[w] = industry })
addHeads('Jewelry', ['necklace', 'earring', 'bracelet', 'ring', 'pendant', 'anklet', 'choker', 'brooch', 'stud', 'hoop'])
addHeads('Personal Care', ['shampoo', 'conditioner', 'soap', 'lotion', 'deodorant', 'toothpaste', 'sunscreen', 'balm', 'serum', 'moisturizer', 'cleanser', 'toner', 'mascara', 'lipstick', 'perfume', 'cologne', 'floss', 'toothbrush'])
addHeads('Food & Pantry', ['coffee', 'tea', 'chocolate', 'honey', 'granola', 'cracker', 'cookie', 'jerky', 'salsa', 'seasoning', 'syrup', 'jam', 'cereal', 'pasta', 'snack'])
addHeads('Apparel', ['shirt', 'tshirt', 'tee', 'hoodie', 'sweatshirt', 'pant', 'jean', 'short', 'dress', 'skirt', 'jacket', 'coat', 'vest', 'sweater', 'cardigan', 'sock', 'legging', 'jogger', 'hat', 'beanie', 'polo', 'blouse', 'tank', 'romper', 'jumpsuit', 'bra', 'underwear', 'boxer', 'brief', 'pullover', 'parka', 'shoe', 'boot', 'sneaker', 'sandal', 'slipper', 'moccasin', 'clog', 'loafer'])
addHeads('Textiles & Rugs', ['rug', 'towel', 'blanket', 'duvet', 'quilt', 'pillowcase', 'sheet', 'comforter'])
addHeads('Furniture', ['sofa', 'couch', 'chair', 'desk', 'dresser', 'bench', 'stool', 'bookshelf', 'nightstand', 'ottoman', 'mattress', 'sectional', 'loveseat'])
addHeads('Home Goods', ['mug', 'candle', 'vase', 'planter'])

// Words that only mean the item when the store is the right kind:
// "ring" from a boutique is jewelry, from a hardware supplier it's an O-ring;
// "chocolate"/"coffee"/"honey" from a clothing store are colors.
const COLOR_WORDS = new Set(['coffee', 'chocolate', 'honey', 'tea'])
const ONLY_FROM = {
  ring: ['Apparel', 'Jewelry'], stud: ['Apparel', 'Jewelry'], hoop: ['Apparel', 'Jewelry'],
  tank: ['Apparel', 'Sporting Goods', 'Food & Pantry'],
}
const NOT_ITEM = /\b(training pants|top coat|base coat|dryer sheets?|sticker sheets?|paper towels?|sheet masks?|baking sheets?|dish|laundry|dishwasher)\b/

const TRAILING_NOISE = /^(\d.*|oz|fl|lb|lbs|ct|count|pk|pack|piece|pc|g|kg|ml|l|in|inch|ft|x|each|set|of|kit|bundle|duo|trio|assorted|women's|womens|men's|mens|kids|kid's|unisex|youth|adult|small|medium|large|xl|new|sale|organic|black|white|grey|gray|blue|red|green|natural)$/

function singular(w) {
  if (w.length <= 3) return w
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (/(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2)
  if (/(ss|us|is)$/.test(w)) return w
  return w.endsWith('s') ? w.slice(0, -1) : w
}

export function productIndustry(title, storeIndustry) {
  const t = (title || '').toLowerCase().replace(/t[-\s]shirt/g, 'tshirt')
  // "Dish Soap", "Dryer Sheets" etc. stay with the store's category
  if (NOT_ITEM.test(t)) return storeIndustry
  const main = t.split(/\s[-|–—]\s|[(@,:]/)[0]
  const tokens = main.split(/[^a-z0-9']+/).filter(w => w && !TRAILING_NOISE.test(w))
  const head = tokens.length ? singular(tokens[tokens.length - 1]) : ''
  const industry = HEAD_CATEGORY[head]
  if (!industry) return storeIndustry
  if (ONLY_FROM[head] && !ONLY_FROM[head].includes(storeIndustry)) return storeIndustry
  if (COLOR_WORDS.has(head) && ['Apparel', 'Jewelry', 'Textiles & Rugs', 'Furniture'].includes(storeIndustry)) return storeIndustry
  return industry
}
