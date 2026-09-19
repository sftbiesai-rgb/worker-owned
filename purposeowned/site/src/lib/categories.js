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
