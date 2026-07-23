// @ts-check
/**
 * Pure renderers: turn a feed meta object + FeedItem[] into Atom 1.0, RSS 2.0
 * or JSON Feed 1.1 text. No file system access here on purpose, everything
 * these functions need is passed in or imported from config.mjs (which is
 * itself pure: it only reads an env var once at import time).
 *
 * Determinism: nothing in this file reads the current clock. A feed's
 * `updated` (Atom) / `lastBuildDate` (RSS) / `date_modified`-driving value is
 * always derived from the item dates that were handed in, falling back to
 * the fixed SITE.established constant when there are no items. Given the
 * same `feed` + `items` input, every renderer here returns byte-identical
 * output every time it runs.
 */
import { SITE } from './config.mjs'

/**
 * @typedef {Object} FeedMeta
 * @property {string} id - Stable tag: URI identifying this feed (not an item).
 * @property {string} title - Feed title.
 * @property {string} description - Feed description / subtitle.
 * @property {string} homeUrl - Absolute URL of the human-facing page this feed represents.
 * @property {string} selfUrl - Absolute URL of this exact feed document (this format).
 */

// ---------------------------------------------------------------------------
// Escaping / formatting helpers
// ---------------------------------------------------------------------------

/**
 * Escape the five characters that are unsafe in XML text or attribute
 * values: & < > " '. Safe to use in both contexts, since escaping quotes
 * inside plain text is harmless.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Wrap a string in a CDATA section so raw HTML can be embedded in an XML
 * element without escaping every tag. A literal `]]>` inside the input would
 * otherwise terminate the section early, so any occurrence is split across
 * two adjacent CDATA sections (a standard, lossless workaround).
 *
 * @param {string} str
 * @returns {string}
 */
export function cdata(str) {
  const safe = String(str).replace(/]]>/g, ']]]]><![CDATA[>')
  return `<![CDATA[${safe}]]>`
}

/**
 * Format a Date as RSS 2.0's pubDate / lastBuildDate (RFC 822/1123), always
 * in UTC, e.g. "Tue, 21 Jul 2026 18:01:12 GMT".
 *
 * @param {Date} date
 * @returns {string}
 */
export function rfc822(date) {
  return date.toUTCString()
}

/**
 * Format a Date as Atom/JSON Feed's date format (RFC 3339 / ISO 8601), in
 * UTC, e.g. "2026-07-21T18:01:12.000Z".
 *
 * @param {Date} date
 * @returns {string}
 */
export function rfc3339(date) {
  return date.toISOString()
}

/**
 * Latest of an item list's dates for a given field, or `fallback` when the
 * list is empty. Used to derive a feed's "last updated" timestamp from its
 * items without ever consulting the current clock.
 *
 * @param {import('./config.mjs').FeedItem[]} items
 * @param {'published' | 'updated'} field
 * @param {Date} fallback
 * @returns {Date}
 */
function latestDate(items, field, fallback) {
  if (items.length === 0) return fallback
  return items.reduce(
    (latest, item) => (item[field] > latest ? item[field] : latest),
    items[0][field],
  )
}

const ESTABLISHED = new Date(SITE.established)

// ---------------------------------------------------------------------------
// Atom 1.0
// ---------------------------------------------------------------------------

/**
 * @param {{ feed: FeedMeta, items: import('./config.mjs').FeedItem[] }} args
 * @returns {string}
 */
export function renderAtom({ feed, items }) {
  const updated = rfc3339(latestDate(items, 'updated', ESTABLISHED))

  const entries = items
    .map((item) => {
      const categories = item.tags
        .map((tag) => `    <category term="${escapeXml(tag)}"/>`)
        .join('\n')
      return [
        '  <entry>',
        `    <id>${escapeXml(item.id)}</id>`,
        `    <title>${escapeXml(item.title)}</title>`,
        `    <link rel="alternate" href="${escapeXml(item.url)}"/>`,
        `    <updated>${rfc3339(item.updated)}</updated>`,
        `    <published>${rfc3339(item.published)}</published>`,
        `    <summary>${escapeXml(item.summary)}</summary>`,
        `    <content type="html">${cdata(item.contentHtml)}</content>`,
        categories,
        '  </entry>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(feed.title)}</title>`,
    `  <subtitle>${escapeXml(feed.description)}</subtitle>`,
    `  <id>${escapeXml(feed.id)}</id>`,
    `  <updated>${updated}</updated>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(feed.selfUrl)}"/>`,
    `  <link rel="alternate" href="${escapeXml(feed.homeUrl)}"/>`,
    `  <author>`,
    `    <name>${escapeXml(SITE.author.name)}</name>`,
    `  </author>`,
    `  <icon>${escapeXml(SITE.icon)}</icon>`,
    entries,
    '</feed>',
  ]
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// RSS 2.0
// ---------------------------------------------------------------------------

/**
 * @param {{ feed: FeedMeta, items: import('./config.mjs').FeedItem[] }} args
 * @returns {string}
 */
export function renderRss({ feed, items }) {
  const lastBuildDate = rfc822(latestDate(items, 'updated', ESTABLISHED))

  const rssItems = items
    .map((item) => {
      const categories = item.tags
        .map((tag) => `    <category>${escapeXml(tag)}</category>`)
        .join('\n')
      return [
        '  <item>',
        `    <title>${escapeXml(item.title)}</title>`,
        `    <link>${escapeXml(item.url)}</link>`,
        `    <guid isPermaLink="false">${escapeXml(item.id)}</guid>`,
        `    <pubDate>${rfc822(item.published)}</pubDate>`,
        `    <description>${cdata(item.summary)}</description>`,
        `    <content:encoded>${cdata(item.contentHtml)}</content:encoded>`,
        categories,
        '  </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `  <title>${escapeXml(feed.title)}</title>`,
    `  <link>${escapeXml(feed.homeUrl)}</link>`,
    `  <description>${escapeXml(feed.description)}</description>`,
    `  <language>${escapeXml(SITE.language)}</language>`,
    `  <atom:link rel="self" href="${escapeXml(feed.selfUrl)}" type="application/rss+xml"/>`,
    `  <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    '  <image>',
    `    <url>${escapeXml(SITE.icon)}</url>`,
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <link>${escapeXml(feed.homeUrl)}</link>`,
    '  </image>',
    rssItems,
    '</channel>',
    '</rss>',
  ]
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// JSON Feed 1.1
// ---------------------------------------------------------------------------

/**
 * @param {{ feed: FeedMeta, items: import('./config.mjs').FeedItem[] }} args
 * @returns {string}
 */
export function renderJsonFeed({ feed, items }) {
  const doc = {
    version: 'https://jsonfeed.org/version/1.1',
    title: feed.title,
    home_page_url: feed.homeUrl,
    feed_url: feed.selfUrl,
    description: feed.description,
    icon: SITE.icon,
    favicon: SITE.icon,
    language: SITE.language,
    authors: [{ name: SITE.author.name, url: SITE.author.url }],
    items: items.map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      content_html: item.contentHtml,
      content_text: item.contentMarkdown,
      summary: item.summary,
      date_published: rfc3339(item.published),
      date_modified: rfc3339(item.updated),
      image: item.image,
      tags: item.tags,
      authors: [{ name: item.author }],
    })),
  }
  return JSON.stringify(doc, null, 2)
}
