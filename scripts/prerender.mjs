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
