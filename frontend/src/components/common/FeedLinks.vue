<template>
  <span class="feed-links">
    <a
      v-for="feed in feeds"
      :key="feed.href"
      class="feed-links__item"
      :href="feed.href"
      :title="feed.title"
      target="_blank"
      rel="noopener noreferrer"
    >{{ feed.label }}</a>
  </span>
</template>

<script setup>
// Release notes feeds, generated at build time by scripts/build-feed.mjs.
// feed.xml is Atom, rss.xml is RSS 2.0, feed.json is JSON Feed 1.1.
const feeds = [
  { label: 'RSS', href: '/rss.xml', title: 'Badge Box release notes - RSS 2.0' },
  { label: 'Atom', href: '/feed.xml', title: 'Badge Box release notes - Atom 1.0' },
  { label: 'JSON', href: '/feed.json', title: 'Badge Box release notes - JSON Feed' }
]
</script>

<style scoped>
.feed-links {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.feed-links__item {
  color: var(--color-text-subtle);
  text-decoration: none;
  transition: color 0.15s ease;
}

.feed-links__item:hover {
  color: var(--color-text-muted);
  text-decoration: underline;
}
</style>
