import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const routes = [
  {
    url: '/coffee',
    title: 'Worker-Owned Coffee Shops in the US | Worker Owned',
    description: 'Browse all worker-owned coffee shops, cafes, and bakeries across the United States. Find cooperatively owned coffee near you.',
    canonical: 'https://www.workerowned.info/coffee',
  },
  {
    url: '/restaurants',
    title: 'Worker-Owned Restaurants in the US | Worker Owned',
    description: 'Browse all worker-owned restaurants, brewpubs, and diners across the United States. Find cooperatively owned food near you.',
    canonical: 'https://www.workerowned.info/restaurants',
  },
  {
    url: '/marketplace/coffee-tea',
    title: 'Worker-Owned Coffee & Tea Online | Worker Owned',
    description: 'Shop worker-owned coffee roasters and tea brands online. Cooperatively owned coffee roasted and shipped direct to your door.',
    canonical: 'https://www.workerowned.info/marketplace/coffee-tea',
  },
  {
    url: '/marketplace/books-publishing',
    title: 'Worker-Owned Bookstores & Publishers Online | Worker Owned',
    description: 'Buy books from worker-owned bookstores and independent publishers. Radical, independent, and cooperatively owned.',
    canonical: 'https://www.workerowned.info/marketplace/books-publishing',
  },
  {
    url: '/marketplace/food-pantry',
    title: 'Worker-Owned Food & Pantry Online | Worker Owned',
    description: 'Shop worker-owned food brands online. Cooperatively owned nut butters, pickles, chocolate, olive oil, and pantry staples.',
    canonical: 'https://www.workerowned.info/marketplace/food-pantry',
  },
  {
    url: '/marketplace/apparel',
    title: 'Worker-Owned Clothing & Apparel Online | Worker Owned',
    description: 'Shop worker-owned clothing and apparel brands online. Cooperatively owned, USA-made, fair labor fashion.',
    canonical: 'https://www.workerowned.info/marketplace/apparel',
  },
  {
    url: '/marketplace/art-prints',
    title: 'Worker-Owned Art Prints & Posters Online | Worker Owned',
    description: 'Buy art prints and posters from worker-owned artist cooperatives. Political, social movement, and activist art ships worldwide.',
    canonical: 'https://www.workerowned.info/marketplace/art-prints',
  },
  {
    url: '/marketplace/music',
    title: 'Worker-Owned Music Platforms | Worker Owned',
    description: 'Stream and buy music on cooperatively owned platforms. Worker-owned Bandcamp alternatives where artists keep more.',
    canonical: 'https://www.workerowned.info/marketplace/music',
  },
  {
    url: '/marketplace/home-goods',
    title: 'Worker-Owned Home Goods & Handmade Products Online | Worker Owned',
    description: 'Shop worker-owned home goods and handmade products online. Cooperatively made ceramics, textiles, candles, and more.',
    canonical: 'https://www.workerowned.info/marketplace/home-goods',
  },
  {
    url: '/marketplace/personal-care',
    title: 'Worker-Owned Soap & Personal Care Online | Worker Owned',
    description: 'Shop worker-owned soaps and personal care products online. Cooperatively made with natural ingredients.',
    canonical: 'https://www.workerowned.info/marketplace/personal-care',
  },
  {
    url: '/marketplace/games',
    title: 'Worker-Owned Board Games Online | Worker Owned',
    description: 'Buy board games from worker-owned cooperatives. Social justice and cooperative games made in the USA.',
    canonical: 'https://www.workerowned.info/marketplace/games',
  },
  {
    url: '/marketplace/beer-brewing',
    title: 'Worker-Owned Breweries & Craft Beer | Worker Owned',
    description: 'Find worker-owned and cooperatively owned breweries. Craft beer made by and for the workers who brew it.',
    canonical: 'https://www.workerowned.info/marketplace/beer-brewing',
  },
]

// Build SSR bundle
await build({
  root,
  plugins: [react()],
  build: {
    ssr: 'src/entry-server.jsx',
    outDir: 'dist/server',
  },
})

// Load SSR render function
const { render } = await import(resolve(root, 'dist/server/entry-server.js'))
const template = readFileSync(resolve(root, 'dist/index.html'), 'utf-8')

for (const route of routes) {
  const appHtml = render(route.url)
  const outDir = resolve(root, `dist${route.url}`)

  const html = template
    .replace('<!--app-html-->', appHtml)
    .replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${route.description}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${route.canonical}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${route.canonical}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${route.title}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${route.description}"`)
    .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${route.title}"`)
    .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${route.description}"`)

  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'index.html'), html)
  console.log(`Prerendered ${route.url}`)
}

// Clean up SSR build
rmSync(resolve(root, 'dist/server'), { recursive: true, force: true })
console.log('Prerender complete.')
