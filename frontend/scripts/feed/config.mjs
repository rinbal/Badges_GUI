// @ts-check
/**
 * Feed identity and category registry, shared by every feed builder module.
 *
 * This is the single place that resolves the public origin and holds the
 * site-level metadata (title, description, icon, and so on) that goes into
 * every RSS/Atom/JSON feed. Nothing outside this file should hardcode the
 * Badge Box domain: read it from SITE.
 *
 *   import { SITE, CATEGORIES, CATEGORY_BY_KEY } from './config.mjs'
 */

/**
 * @typedef {Object} CategoryConfig
 * @property {string} key - Stable identifier used in URLs and file names (e.g. 'release').
 * @property {string} title - Human-readable feed title for this category.
 * @property {string} description - One-line feed description.
 * @property {string} pathPrefix - Path prefix used to build item permalinks (e.g. '/news').
 * @property {string[]} defaultTags - Tags applied to an item when it supplies none of its own.
 */

/**
 * @typedef {Object} FeedItem
 * @property {string} id - Stable tag: URI, used as the idempotency key (Atom id, RSS guid, JSON id).
 * @property {string} url - Canonical, absolute permalink for the item.
 * @property {string} title - Item title.
 * @property {string} category - The CategoryConfig.key this item belongs to.
 * @property {Date} published - First-published date.
 * @property {Date} updated - Last-updated date (equals `published` when an item has not been revised).
 * @property {string} summary - Plain-text summary (no markdown/HTML).
 * @property {string} contentMarkdown - Full item body as markdown, frontmatter already stripped.
 * @property {string} contentHtml - `contentMarkdown` rendered to HTML.
 * @property {string} image - Absolute URL of the item's representative image.
 * @property {string[]} tags - Tags/categories for the item.
 * @property {string} author - Display name of the item's author.
 */

const RAW_ORIGIN = process.env.VITE_PUBLIC_ORIGIN || 'https://badgebox.rinbal.de'
const ORIGIN = RAW_ORIGIN.replace(/\/+$/, '')

/**
 * Site-wide identity shared by every feed (combined and per-category).
 *
 * `established` is the deterministic fallback for a feed's `updated`/
 * `lastBuildDate`/`date_modified` when it has zero items (an empty "news" or
 * "blog" feed today). Using a fixed constant instead of the current time
 * keeps empty-feed output byte-identical across builds, per the no-churn
 * requirement.
 *
 * `tagAuthorityDate` is the fixed year used in every `tag:` URI item id
 * (RFC 4151). It must never change: item ids are the idempotency key a
 * downstream consumer uses to detect "have I already published this", so the
 * date component is pinned once and left alone even as new items are added in
 * later years.
 *
 * `releaseNotesBase` is where a release item's permalink points. Badge Box has
 * no per-release web page, so items link to the matching GitHub release tag,
 * the same target the in-app version footer links to.
 */
export const SITE = Object.freeze({
  origin: ORIGIN,
  title: 'Badge Box',
  description:
    'Releases and updates from Badge Box, create, award, request and collect decentralized badges on the Nostr network (NIP-58).',
  language: 'en',
  author: Object.freeze({ name: 'Badge Box', url: ORIGIN }),
  icon: `${ORIGIN}/icons/icon-512x512.png`,
  defaultImage: `${ORIGIN}/metatag_preview.jpg`,
  tagAuthority: 'badgebox.rinbal.de',
  tagAuthorityDate: '2026',
  established: '2026-01-01T00:00:00Z',
  releaseNotesBase: 'https://github.com/rinbal/Badges_GUI/releases/tag',
})

/**
 * Feed categories, in the order they should be listed. Each category gets
 * its own set of Atom/RSS/JSON feed files under public/feeds/, in addition
 * to appearing in the combined all-categories feed. `release` is the active
 * category today ; `news` and `blog` are wired for the future and simply
 * produce empty (still valid) feeds until content lands in those folders.
 *
 * @type {ReadonlyArray<CategoryConfig>}
 */
export const CATEGORIES = Object.freeze([
  Object.freeze({
    key: 'release',
    title: 'Badge Box Releases',
    description: 'Release notes and changelogs for every version of Badge Box.',
    pathPrefix: '/about',
    defaultTags: Object.freeze(['badgebox', 'release', 'changelog']),
  }),
  Object.freeze({
    key: 'news',
    title: 'Badge Box News',
    description: 'Announcements and updates from the Badge Box team.',
    pathPrefix: '/news',
    defaultTags: Object.freeze(['badgebox', 'news']),
  }),
  Object.freeze({
    key: 'blog',
    title: 'Badge Box Blog',
    description: 'Longer writing on badges, Nostr and the open web.',
    pathPrefix: '/blog',
    defaultTags: Object.freeze(['badgebox', 'blog']),
  }),
])

/** @type {Readonly<Record<string, CategoryConfig>>} */
export const CATEGORY_BY_KEY = Object.freeze(
  Object.fromEntries(CATEGORIES.map((cat) => [cat.key, cat])),
)
