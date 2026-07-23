// @ts-check
/**
 * Static feed builder: generates RSS 2.0, Atom 1.0 and JSON Feed 1.1 for the
 * combined "all categories" feed plus one set per category (release, news,
 * blog), and writes them into public/ so vite's public-dir copy ships them
 * unchanged into dist/.
 *
 *   node scripts/build-feed.mjs
 *
 * All logic lives in scripts/feed/*.mjs, this file just wires loaders to
 * renderers to file writes and reports what it wrote. Run before `vite
 * build` (see the "build" script in package.json).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES, SITE } from './feed/config.mjs'
import { loadAllItems, loadItemsByCategory } from './feed/content.mjs'
import { renderAtom, renderJsonFeed, renderRss } from './feed/render.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const publicDir = resolve(root, 'public')
const feedsDir = resolve(publicDir, 'feeds')

mkdirSync(feedsDir, { recursive: true })

/** @param {string} absPath @param {string} contents */
function write(absPath, contents) {
  writeFileSync(absPath, contents)
  const relPath = absPath.slice(root.length + 1)
  console.log(`wrote ${relPath} (${Buffer.byteLength(contents)} bytes)`)
}

// ---------------------------------------------------------------------------
// Combined "all categories" feed
// ---------------------------------------------------------------------------

const allItems = loadAllItems()
const combinedId = `tag:${SITE.tagAuthority},${SITE.tagAuthorityDate}:feed`
const combinedHomeUrl = `${SITE.origin}/`

write(
  resolve(publicDir, 'feed.xml'),
  renderAtom({
    feed: {
      id: combinedId,
      title: SITE.title,
      description: SITE.description,
      homeUrl: combinedHomeUrl,
      selfUrl: `${SITE.origin}/feed.xml`,
    },
    items: allItems,
  }),
)

write(
  resolve(publicDir, 'rss.xml'),
  renderRss({
    feed: {
      id: combinedId,
      title: SITE.title,
      description: SITE.description,
      homeUrl: combinedHomeUrl,
      selfUrl: `${SITE.origin}/rss.xml`,
    },
    items: allItems,
  }),
)

write(
  resolve(publicDir, 'feed.json'),
  renderJsonFeed({
    feed: {
      id: combinedId,
      title: SITE.title,
      description: SITE.description,
      homeUrl: combinedHomeUrl,
      selfUrl: `${SITE.origin}/feed.json`,
    },
    items: allItems,
  }),
)

// ---------------------------------------------------------------------------
// Per-category feeds
// ---------------------------------------------------------------------------

for (const cat of CATEGORIES) {
  const items = loadItemsByCategory(cat.key)
  const id = `tag:${SITE.tagAuthority},${SITE.tagAuthorityDate}:feed/${cat.key}`
  const homeUrl = `${SITE.origin}${cat.pathPrefix}`

  write(
    resolve(feedsDir, `${cat.key}.xml`),
    renderAtom({
      feed: {
        id,
        title: cat.title,
        description: cat.description,
        homeUrl,
        selfUrl: `${SITE.origin}/feeds/${cat.key}.xml`,
      },
      items,
    }),
  )

  write(
    resolve(feedsDir, `${cat.key}.rss.xml`),
    renderRss({
      feed: {
        id,
        title: cat.title,
        description: cat.description,
        homeUrl,
        selfUrl: `${SITE.origin}/feeds/${cat.key}.rss.xml`,
      },
      items,
    }),
  )

  write(
    resolve(feedsDir, `${cat.key}.json`),
    renderJsonFeed({
      feed: {
        id,
        title: cat.title,
        description: cat.description,
        homeUrl,
        selfUrl: `${SITE.origin}/feeds/${cat.key}.json`,
      },
      items,
    }),
  )
}

console.log(`done: ${1 + CATEGORIES.length} feed sets (${(1 + CATEGORIES.length) * 3} files)`)
