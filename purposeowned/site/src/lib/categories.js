// B Corp industry categories mapped from the data
export const CATEGORIES = [
  { slug: 'food',           label: 'Food & Pantry',        industry: 'Food products' },
  { slug: 'apparel',        label: 'Apparel',              industry: 'Apparel' },
  { slug: 'personal-care',  label: 'Personal Care',        industry: 'Personal care products' },
  { slug: 'beverages',      label: 'Beverages',            industry: 'Beverages' },
  { slug: 'home-goods',     label: 'Home Goods',           industry: 'Other manufacturing' },
  { slug: 'agriculture',    label: 'Agriculture',          industry: 'Agricultural Processing' },
  { slug: 'sporting-goods', label: 'Sporting Goods',       industry: 'Sports goods' },
  { slug: 'cleaning',       label: 'Cleaning Products',    industry: 'Cleaning products' },
  { slug: 'furniture',      label: 'Furniture',            industry: 'Furniture' },
  { slug: 'textiles',       label: 'Textiles & Rugs',      industry: 'Textiles' },
  { slug: 'retail',         label: 'Retail & Gifts',       industry: 'Other retail sale' },
  { slug: 'jewelry',        label: 'Jewelry',              industry: 'Jewelry & related articles' },
  { slug: 'wholesale',      label: 'Wholesale',            industry: 'Other/general wholesale trade' },
]

export const INDUSTRY_TO_SLUG = Object.fromEntries(
  CATEGORIES.map(c => [c.industry, c.slug])
)
