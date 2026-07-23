import assert from 'node:assert/strict'
import test from 'node:test'
import { compareSemver, loadReleaseItems, parseFrontmatter } from './content.mjs'

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

test('parseFrontmatter extracts scalars and an inline array, and strips the fenced block from body', () => {
  const raw = [
    '---',
    'date: 2026-07-23',
    'summary: Private DMs and community chat.',
    'tags: [badgebox, release, changelog]',
    '---',
    '# Badge Box v3.0.0',
    '',
    'Body text.',
    '',
  ].join('\n')

  const { data, body } = parseFrontmatter(raw)

  assert.equal(data.date, '2026-07-23')
  assert.equal(data.summary, 'Private DMs and community chat.')
  assert.deepEqual(data.tags, ['badgebox', 'release', 'changelog'])
  assert.doesNotMatch(body, /---/)
  assert.match(body, /^# Badge Box v3\.0\.0/)
})

test('parseFrontmatter strips surrounding quotes from scalar values', () => {
  const raw = ['---', 'title: "Badge Box v3.0.0"', "slug: 'badge-box-v3-0-0'", '---', 'Body.'].join('\n')
  const { data } = parseFrontmatter(raw)
  assert.equal(data.title, 'Badge Box v3.0.0')
  assert.equal(data.slug, 'badge-box-v3-0-0')
})

test('parseFrontmatter with no leading fence returns the raw body unchanged and empty data', () => {
  const raw = '# Badge Box v3.0.0\n\nNo frontmatter here.\n'
  const { data, body } = parseFrontmatter(raw)
  assert.deepEqual(data, {})
  assert.equal(body, raw)
})

// ---------------------------------------------------------------------------
// compareSemver
// ---------------------------------------------------------------------------

test('compareSemver orders 0.10.0 > 0.9.0 > 0.2.0 numerically, not lexically', () => {
  assert.ok(compareSemver('0.10.0', '0.9.0') > 0)
  assert.ok(compareSemver('0.9.0', '0.2.0') > 0)
  assert.ok(compareSemver('0.10.0', '0.2.0') > 0)
  assert.equal(compareSemver('0.3.0', '0.3.0'), 0)
})

// ---------------------------------------------------------------------------
// loadReleaseItems (reads the real Release_Notes/ directory in this repo)
// ---------------------------------------------------------------------------

test('loadReleaseItems loads the v3.0.0 release, excludes prompt templates, newest first', () => {
  const items = loadReleaseItems()

  // Prompt templates must never leak into the feed.
  assert.ok(!items.some((item) => /PROMPT/i.test(item.title)))
  assert.ok(!items.some((item) => item.id.includes('PROMPT')))

  assert.ok(items.length >= 1)
  assert.equal(items[0].id, 'tag:badgebox.rinbal.de,2026:release/v3.0.0')
  assert.equal(items[0].title, 'Badge Box v3.0.0')
  assert.equal(items[0].url, 'https://github.com/rinbal/Badges_GUI/releases/tag/v3.0.0')

  // Descending by semver: each item is >= the next.
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1].id.replace(/^.*release\/v/, '')
    const cur = items[i].id.replace(/^.*release\/v/, '')
    assert.ok(compareSemver(prev, cur) >= 0)
  }
})

test('loadReleaseItems strips frontmatter out of contentMarkdown', () => {
  const items = loadReleaseItems()
  for (const item of items) {
    assert.doesNotMatch(item.contentMarkdown, /^---/)
  }
})
