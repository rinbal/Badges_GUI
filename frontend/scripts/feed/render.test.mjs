import assert from 'node:assert/strict'
import test from 'node:test'
import { cdata, escapeXml, renderAtom, renderJsonFeed, renderRss, rfc3339, rfc822 } from './render.mjs'

/** @returns {import('./config.mjs').FeedItem} */
function sampleItem() {
  return {
    id: 'tag:badgebox.rinbal.de,2026:release/v3.0.0',
    url: 'https://github.com/rinbal/Badges_GUI/releases/tag/v3.0.0',
    title: 'Badge Box v3.0.0',
    category: 'release',
    published: new Date('2026-07-23T09:00:00.000Z'),
    updated: new Date('2026-07-23T09:00:00.000Z'),
    summary: 'Private DMs, community chat and badge requests.',
    contentMarkdown: '# Badge Box v3.0.0\n\n## Highlights\n\n- Private DMs.\n',
    contentHtml: '<h1>Badge Box v3.0.0</h1>\n<h2>Highlights</h2>\n<ul>\n<li>Private DMs.</li>\n</ul>\n',
    image: 'https://badgebox.rinbal.de/metatag_preview.jpg',
    tags: ['badgebox', 'release', 'changelog'],
    author: 'Badge Box',
  }
}

function sampleFeed(selfUrl) {
  return {
    id: 'tag:badgebox.rinbal.de,2026:feed',
    title: 'Badge Box',
    description: 'Releases and updates from Badge Box.',
    homeUrl: 'https://badgebox.rinbal.de/',
    selfUrl,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

test('escapeXml escapes all five reserved characters', () => {
  const out = escapeXml(`Tom & Jerry <say> "hi" 'there'`)
  assert.equal(out, 'Tom &amp; Jerry &lt;say&gt; &quot;hi&quot; &apos;there&apos;')
})

test('cdata wraps content and safely splits a literal ]]>', () => {
  assert.equal(cdata('<p>hi</p>'), '<![CDATA[<p>hi</p>]]>')
  // A literal "]]>" inside the input would otherwise terminate the section
  // early, so it must be split across two adjacent CDATA sections.
  assert.equal(cdata('a]]>b'), '<![CDATA[a]]]]><![CDATA[>b]]>')
})

test('rfc822 formats a date as RSS pubDate (UTC, RFC 822/1123)', () => {
  const date = new Date('2026-07-21T18:01:12.000Z')
  assert.equal(rfc822(date), 'Tue, 21 Jul 2026 18:01:12 GMT')
})

test('rfc3339 formats a date as ISO 8601 UTC', () => {
  const date = new Date('2026-07-21T18:01:12.000Z')
  assert.equal(rfc3339(date), '2026-07-21T18:01:12.000Z')
})

// ---------------------------------------------------------------------------
// Atom
// ---------------------------------------------------------------------------

test('renderAtom produces a well-formed entry with content, id and categories', () => {
  const item = sampleItem()
  const xml = renderAtom({ feed: sampleFeed('https://badgebox.rinbal.de/feed.xml'), items: [item] })

  assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/)
  assert.match(xml, /<entry>/)
  assert.ok(xml.includes(`<id>${item.id}</id>`))
  assert.match(xml, /<content type="html">/)
  assert.match(xml, /<!\[CDATA\[/)
  assert.match(xml, /<category term="badgebox"\/>/)
  assert.match(xml, /<category term="release"\/>/)
  assert.match(xml, /<category term="changelog"\/>/)
})

test('renderAtom on an empty item list is a valid feed with no entries', () => {
  const xml = renderAtom({ feed: sampleFeed('https://badgebox.rinbal.de/feed.xml'), items: [] })
  assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/)
  assert.doesNotMatch(xml, /<entry>/)
  assert.match(xml, /<updated>2026-01-01T00:00:00\.000Z<\/updated>/)
})

// ---------------------------------------------------------------------------
// RSS
// ---------------------------------------------------------------------------

test('renderRss produces a well-formed item with guid, pubDate and content:encoded', () => {
  const item = sampleItem()
  const xml = renderRss({ feed: sampleFeed('https://badgebox.rinbal.de/rss.xml'), items: [item] })

  assert.match(xml, /<channel>/)
  assert.match(xml, /<item>/)
  assert.match(xml, /<guid isPermaLink="false">tag:badgebox\.rinbal\.de,2026:release\/v3\.0\.0<\/guid>/)
  assert.match(xml, /<pubDate>Thu, 23 Jul 2026 09:00:00 GMT<\/pubDate>/)
  assert.match(xml, /<content:encoded>/)
})

test('renderRss on an empty item list is a valid channel with no items', () => {
  const xml = renderRss({ feed: sampleFeed('https://badgebox.rinbal.de/rss.xml'), items: [] })
  assert.match(xml, /<channel>/)
  assert.doesNotMatch(xml, /<item>/)
  assert.match(xml, /<lastBuildDate>Thu, 01 Jan 2026 00:00:00 GMT<\/lastBuildDate>/)
})

// ---------------------------------------------------------------------------
// JSON Feed
// ---------------------------------------------------------------------------

test('renderJsonFeed parses as valid JSON with content_text = markdown and content_html = html', () => {
  const item = sampleItem()
  const json = renderJsonFeed({ feed: sampleFeed('https://badgebox.rinbal.de/feed.json'), items: [item] })
  const parsed = JSON.parse(json)

  assert.equal(parsed.version, 'https://jsonfeed.org/version/1.1')
  assert.equal(parsed.items.length, 1)
  assert.equal(parsed.items[0].content_text, item.contentMarkdown)
  assert.equal(parsed.items[0].content_html, item.contentHtml)
  assert.equal(parsed.items[0].id, item.id)
})

test('renderJsonFeed on an empty item list is valid JSON with items: []', () => {
  const json = renderJsonFeed({ feed: sampleFeed('https://badgebox.rinbal.de/feed.json'), items: [] })
  const parsed = JSON.parse(json)
  assert.deepEqual(parsed.items, [])
  assert.equal(parsed.version, 'https://jsonfeed.org/version/1.1')
})
