<template>
  <a
    class="app-version"
    :href="releaseUrl"
    target="_blank"
    rel="noopener noreferrer"
    :title="titleText"
  >
    <span class="app-version__tag">{{ displayVersion }}</span>
    <template v-if="commit">
      <span class="app-version__sep">·</span>
      <span class="app-version__commit">{{ commit }}</span>
    </template>
  </a>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// GitHub repo that publishes Badge Box releases.
const REPO = 'rinbal/Badges_GUI'
const CACHE_KEY = 'bb_latest_release'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

// Injected at build time by Vite (see vite.config.js). `typeof` guards keep this
// safe if the defines are ever missing.
const buildVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
const commit = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : ''

// Latest release tag pulled live from GitHub. Empty until it resolves.
const latestTag = ref('')

const activeTag = computed(() => latestTag.value || buildVersion)

const displayVersion = computed(() => {
  const v = activeTag.value || 'dev'
  return v.startsWith('v') ? v : `v${v}`
})

const releaseUrl = computed(() =>
  activeTag.value
    ? `https://github.com/${REPO}/releases/tag/${activeTag.value}`
    : `https://github.com/${REPO}/releases`
)

const titleText = computed(() => {
  const parts = [`Badge Box ${displayVersion.value}`]
  if (commit) parts.push(`build ${commit}`)
  return parts.join(' · ')
})

// Resolve the current version from the GitHub Releases API so the footer tracks
// releases without a redeploy. Cached, and fails silently (offline, rate limit).
async function loadLatestRelease() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cached?.tag && Date.now() - cached.t < CACHE_TTL) {
      latestTag.value = cached.tag
      return
    }
  } catch { /* ignore malformed cache */ }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return
    const data = await res.json()
    if (data?.tag_name) {
      latestTag.value = data.tag_name
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ tag: data.tag_name, t: Date.now() }))
      } catch { /* storage unavailable */ }
    }
  } catch { /* network error, keep build fallback */ }
}

onMounted(loadLatestRelease)
</script>

<style scoped>
.app-version {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.75rem;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  color: var(--color-text-subtle);
  text-decoration: none;
  letter-spacing: 0.01em;
  transition: color 0.15s ease;
}

.app-version:hover {
  color: var(--color-text-muted);
}

.app-version__sep {
  opacity: 0.6;
}

.app-version__commit {
  opacity: 0.85;
}
</style>
