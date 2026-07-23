// @ts-check
/**
 * Content loading: frontmatter parsing, markdown rendering, summary
 * extraction, and the per-category FeedItem loaders.
 *
 * This module is the only place that touches the file system or shells out
 * to git. render.mjs stays pure so it can be unit-tested with plain fixture
 * objects, everything I/O-shaped lives here instead.
 */
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { CATEGORIES, CATEGORY_BY_KEY, SITE } from './config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// Monorepo layout: this file lives at <repo>/frontend/scripts/feed/, while
// Release_Notes/ (and any future news/ or blog/ folders) live at the repo
// root, so climb three levels up from here.
const REPO_ROOT = resolve(here, '../../..')
const RELEASE_NOTES_DIR = join(REPO_ROOT, 'Release_Notes')

// Matches "RELEASE_NOTES_v3.0.0.md" and captures "3.0.0". This also happens
// to exclude the prompt templates (they don't start with "RELEASE_NOTES_v"),
// but the loader below double-checks those names explicitly, since silently
// relying on a regex accident to keep a prompt template out of a published
// feed is too fragile.
const RELEASE_FILE_RE = /^RELEASE_NOTES_v(.+)\.md$/
const EXCLUDED_FILES = new Set([
  'STANDARD_RELEASE_NOTES_PROMPT.md',
  'BADGEBOX_RELEASE_NOTES_PROMPT.md',
])

// Files that live in a content folder but are never posts (the folder's own
// documentation). Matched case-insensitively.
const CONTENT_EXCLUDED = new Set(['readme.md'])

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Parse a minimal YAML-like frontmatter block delimited by `---` fences at
 * the very top of the file.
 *
 * Supported subset (deliberately small, no YAML library):
 *   - Flat `key: value` scalar lines. A value wrapped in single or double
 *     quotes has the quotes stripped.
 *   - Inline arrays: `key: [a, b, c]`. Each element is trimmed and unquoted
 *     the same way a scalar is.
 *   - Blank lines and `#`-prefixed comment lines inside the block are
 *     skipped.
 * Anything else (nested maps, multiline scalars, YAML flow objects, block
 * scalars, etc.) is out of scope on purpose. Release notes frontmatter only
 * ever needs `date:` and `summary:`, occasionally `title:` / `slug:` /
 * `image:` / `tags:`.
 *
 * When the file has no leading `---` fence, this returns the whole input as
 * `body` with empty `data`, so callers can treat frontmatter as optional.
 *
 * @param {string} raw - Full file contents.
 * @returns {{ data: Record<string, string | string[]>, body: string }}
 */
export function parseFrontmatter(raw) {
  const fenceMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!fenceMatch) return { data: {}, body: raw }

  const block = fenceMatch[1]
  const body = raw.slice(fenceMatch[0].length)
  /** @type {Record<string, string | string[]>} */
  const data = {}

  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const sep = trimmed.indexOf(':')
    if (sep === -1) continue
    const key = trimmed.slice(0, sep).trim()
    if (!key) continue
    data[key] = parseFrontmatterValue(trimmed.slice(sep + 1).trim())
  }

  return { data, body }
}

/** @param {string} rawValue */
function parseFrontmatterValue(rawValue) {
  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    const inner = rawValue.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map((entry) => unquote(entry.trim()))
  }
  return unquote(rawValue)
}

/** @param {string} value */
function unquote(value) {
  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"') && value.length >= 2
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'") && value.length >= 2
  if (isDoubleQuoted || isSingleQuoted) return value.slice(1, -1)
  return value
}

// ---------------------------------------------------------------------------
// Markdown rendering + summary extraction
// ---------------------------------------------------------------------------

/**
 * Render a markdown body to HTML.
 *
 * @param {string} body
 * @returns {string}
 */
export function renderMarkdown(body) {
  return /** @type {string} */ (marked.parse(body))
}

/**
 * Derive a plain-text summary from a markdown body:
 *   1. The first bullet under a `## Highlights` heading, if present.
 *   2. Otherwise the first non-heading, non-blank paragraph line.
 *   3. Otherwise `fallback`.
 * The result has markdown emphasis, links and inline code stripped down to
 * plain text, and is truncated to roughly 200 characters on a word
 * boundary. Purely a function of its input, so it is deterministic and
 * produces byte-identical output across builds.
 *
 * @param {string} body
 * @param {string} fallback
 * @returns {string}
 */
export function extractSummary(body, fallback) {
  const lines = body.split('\n')
  let raw = ''

  const highlightsIndex = lines.findIndex((line) => /^##\s+Highlights\s*$/i.test(line.trim()))
  if (highlightsIndex !== -1) {
    for (let i = highlightsIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (/^#{1,6}\s/.test(trimmed)) break // reached the next heading, no bullet found
      if (/^[-*]\s+/.test(trimmed)) {
        raw = trimmed.replace(/^[-*]\s+/, '')
        break
      }
    }
  }

  if (!raw) {
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || /^#{1,6}\s/.test(trimmed)) continue
      raw = trimmed
      break
    }
  }

  if (!raw) return fallback
  return truncateWords(toPlainText(raw), 200)
}

/** Strip markdown emphasis, links and inline code down to plain text. @param {string} markdown */
function toPlainText(markdown) {
  return markdown
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Truncate to `max` chars on a word boundary, appending "...". @param {string} str @param {number} max */
function truncateWords(str, max) {
  if (str.length <= max) return str
  const cut = str.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const clipped = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return `${clipped}...`
}

// ---------------------------------------------------------------------------
// Git metadata
// ---------------------------------------------------------------------------

/**
 * The date a file was first added to git history, as an ISO 8601 string, or
 * null if it can't be determined (not a git repo, file never committed, git
 * unavailable, etc). `--follow` tracks the file across renames; git log
 * lists newest-first, so the last line of `%aI` output is the original add.
 *
 * @param {string} absPath
 * @returns {string | null}
 */
export function gitAddedDate(absPath) {
  try {
    const out = execSync(`git log --diff-filter=A --follow --format=%aI -- "${absPath}"`, {
      cwd: dirname(absPath),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    if (!out) return null
    const lines = out.split('\n').filter(Boolean)
    return lines.length ? lines[lines.length - 1] : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Semver ordering
// ---------------------------------------------------------------------------

/**
 * Compare two dotted numeric version strings (e.g. "0.10.0" vs "0.9.0")
 * numerically, part by part, so "0.10.0" sorts after "0.9.0" (a plain
 * string comparison would get this backwards). Standard ascending
 * comparator: negative when `a` < `b`, positive when `a` > `b`, zero when
 * equal. Missing trailing parts are treated as 0.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareSemver(a, b) {
  const partsA = String(a).split('.').map(Number)
  const partsB = String(b).split('.').map(Number)
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const na = partsA[i] || 0
    const nb = partsB[i] || 0
    if (na !== nb) return na - nb
  }
  return 0
}

// ---------------------------------------------------------------------------
// Item loaders
// ---------------------------------------------------------------------------

/**
 * Load every `Release_Notes/RELEASE_NOTES_v*.md` file as a FeedItem, sorted
 * descending by semver version (newest release first).
 *
 * Badge Box has no per-release web page, so each item permalink points at the
 * matching GitHub release tag (SITE.releaseNotesBase).
 *
 * @returns {import('./config.mjs').FeedItem[]}
 */
export function loadReleaseItems() {
  const cat = CATEGORY_BY_KEY.release
  let names
  try {
    names = readdirSync(RELEASE_NOTES_DIR)
  } catch {
    return []
  }

  /** @type {{ version: string, item: import('./config.mjs').FeedItem }[]} */
  const built = []

  for (const name of names) {
    if (EXCLUDED_FILES.has(name)) continue
    const match = name.match(RELEASE_FILE_RE)
    if (!match) continue

    const version = match[1]
    const file = join(RELEASE_NOTES_DIR, name)
    const raw = readFileSync(file, 'utf8')
    const { data, body } = parseFrontmatter(raw)

    const h1Match = body.match(/^#\s+(.+)$/m)
    const title = String(data.title || (h1Match ? h1Match[1].trim() : '') || `Badge Box v${version}`)

    let published
    if (data.date) {
      published = new Date(String(data.date))
    } else {
      const added = gitAddedDate(file)
      published = added ? new Date(added) : new Date(statSync(file).mtime)
    }

    /** @type {import('./config.mjs').FeedItem} */
    const item = {
      id: `tag:${SITE.tagAuthority},${SITE.tagAuthorityDate}:release/v${version}`,
      url: String(data.url || `${SITE.releaseNotesBase}/v${version}`),
      title,
      category: cat.key,
      published,
      updated: published,
      summary: String(data.summary || extractSummary(body, title)),
      contentMarkdown: body,
      contentHtml: renderMarkdown(body),
      image: String(data.image || SITE.defaultImage),
      tags: Array.isArray(data.tags) && data.tags.length ? data.tags : [...cat.defaultTags],
      author: SITE.author.name,
    }

    built.push({ version, item })
  }

  built.sort((a, b) => compareSemver(b.version, a.version))
  return built.map((entry) => entry.item)
}

/**
 * Load every markdown post in a content folder (news, blog) as a FeedItem.
 *
 * A post is any `<slug>.md` file in the folder except README.md. Each SHOULD
 * carry `title`, `date` and `summary` frontmatter (see the folder's README);
 * when a field is missing it falls back to, respectively, the first H1 (then
 * the file name), the git-added date (then mtime), and an extracted summary.
 * The folder is optional: a missing folder yields an empty list, so a category
 * with no content simply produces an empty (still valid) feed.
 *
 * Sorted newest-first by date, with the slug as a stable tiebreaker so output
 * stays deterministic regardless of directory read order.
 *
 * @param {import('./config.mjs').CategoryConfig} cat
 * @param {string} dirName - Folder name at the repo root, e.g. 'news'.
 * @returns {import('./config.mjs').FeedItem[]}
 */
function loadPostsFrom(cat, dirName) {
  const dir = join(REPO_ROOT, dirName)
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }

  /** @type {{ published: Date, slug: string, item: import('./config.mjs').FeedItem }[]} */
  const built = []

  for (const name of names) {
    if (!name.endsWith('.md')) continue
    if (CONTENT_EXCLUDED.has(name.toLowerCase())) continue

    const file = join(dir, name)
    const raw = readFileSync(file, 'utf8')
    const { data, body } = parseFrontmatter(raw)

    const slug = String(data.slug || name.replace(/\.md$/, ''))
    const h1Match = body.match(/^#\s+(.+)$/m)
    const title = String(data.title || (h1Match ? h1Match[1].trim() : '') || slug)

    let published
    if (data.date) {
      published = new Date(String(data.date))
    } else {
      const added = gitAddedDate(file)
      published = added ? new Date(added) : new Date(statSync(file).mtime)
    }

    /** @type {import('./config.mjs').FeedItem} */
    const item = {
      id: `tag:${SITE.tagAuthority},${SITE.tagAuthorityDate}:${cat.key}/${slug}`,
      url: `${SITE.origin}${cat.pathPrefix}/${slug}`,
      title,
      category: cat.key,
      published,
      updated: published,
      summary: String(data.summary || extractSummary(body, title)),
      contentMarkdown: body,
      contentHtml: renderMarkdown(body),
      image: String(data.image || SITE.defaultImage),
      tags: Array.isArray(data.tags) && data.tags.length ? data.tags : [...cat.defaultTags],
      author: String(data.author || SITE.author.name),
    }

    built.push({ published, slug, item })
  }

  built.sort((a, b) => {
    const byDate = b.published.getTime() - a.published.getTime()
    if (byDate !== 0) return byDate
    return a.slug.localeCompare(b.slug)
  })
  return built.map((entry) => entry.item)
}

/**
 * News posts, loaded from the repo-root `news/` folder. Empty until the first
 * post lands there. See loadPostsFrom for the file format.
 *
 * @returns {import('./config.mjs').FeedItem[]}
 */
export function loadNewsItems() {
  return loadPostsFrom(CATEGORY_BY_KEY.news, 'news')
}

/**
 * Blog posts, loaded from the repo-root `blog/` folder. Empty until the first
 * post lands there. See loadPostsFrom for the file format.
 *
 * @returns {import('./config.mjs').FeedItem[]}
 */
export function loadBlogItems() {
  return loadPostsFrom(CATEGORY_BY_KEY.blog, 'blog')
}

/**
 * @param {string} key - A CategoryConfig.key ('release', 'news', 'blog').
 * @returns {import('./config.mjs').FeedItem[]}
 */
export function loadItemsByCategory(key) {
  switch (key) {
    case 'release':
      return loadReleaseItems()
    case 'news':
      return loadNewsItems()
    case 'blog':
      return loadBlogItems()
    default:
      return []
  }
}

// Pulls the trailing "vX.Y.Z" version out of a tag: URI item id, for use as
// a deterministic secondary sort key. Items without a version in their id
// (nothing today, but future news/blog items may not carry one) sort as
// "0.0.0", which only matters when two items also share a published date.
const ID_VERSION_RE = /v(\d+(?:\.\d+)*)$/

/** @param {import('./config.mjs').FeedItem} item */
function itemVersion(item) {
  const match = item.id.match(ID_VERSION_RE)
  return match ? match[1] : '0.0.0'
}

/**
 * Load every category's items and merge them into one list, sorted by
 * published date descending, then by version descending as a tiebreaker.
 *
 * @returns {import('./config.mjs').FeedItem[]}
 */
export function loadAllItems() {
  const items = CATEGORIES.flatMap((cat) => loadItemsByCategory(cat.key))

  return items.sort((a, b) => {
    const byDate = b.published.getTime() - a.published.getTime()
    if (byDate !== 0) return byDate
    return compareSemver(itemVersion(b), itemVersion(a))
  })
}
