// B Corp industry categories mapped from the data
export const CATEGORIES = [
  { slug: 'apparel',        label: 'Apparel',              industry: 'Apparel' },
  { slug: 'food',           label: 'Food & Pantry',        industry: 'Food products' },
  { slug: 'beverages',      label: 'Beverages',            industry: 'Beverages' },
  { slug: 'personal-care',  label: 'Personal Care',        industry: 'Personal care products' },
  { slug: 'home-goods',     label: 'Home Goods',           industry: 'Other manufacturing' },
  { slug: 'textiles',       label: 'Textiles & Rugs',      industry: 'Textiles' },
  { slug: 'retail',         label: 'Retail & Gifts',       industry: 'Other retail sale' },
  { slug: 'jewelry',        label: 'Jewelry',              industry: 'Jewelry & related articles' },
  { slug: 'cleaning',       label: 'Cleaning Products',    industry: 'Cleaning products' },
  { slug: 'furniture',      label: 'Furniture',            industry: 'Furniture' },
  { slug: 'books',          label: 'Books & Media',        industry: 'Books or other media' },
  { slug: 'agriculture',    label: 'Agriculture',          industry: 'Agricultural Processing' },
  { slug: 'sporting-goods', label: 'Sporting Goods',       industry: 'Sports goods' },
]

export const INDUSTRY_TO_SLUG = Object.fromEntries(
  CATEGORIES.map(c => [c.industry, c.slug])
)
