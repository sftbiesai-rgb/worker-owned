export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function faviconUrl(siteUrl) {
  if (!siteUrl) return null
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(siteUrl).hostname + '&sz=16' }
  catch { return null }
}

export function displayTags(tags) {
  if (!tags?.length) return null
  return tags
    .map(t => t.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'"))
    .filter(t => t.length > 2 && t.length < 40 && !/^\d+$/.test(t) && !t.includes('_') && !/wholesale/i.test(t))
    .slice(0, 3)
}
