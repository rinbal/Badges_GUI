<template>
  <a
    class="lotus-footer"
    :href="lotusLink"
    target="_blank"
    rel="noopener noreferrer"
  >
    <img src="/Lotus/favicon.png" alt="" class="lotus-logo" aria-hidden="true" />
    <span class="lotus-text">
      Text-only chat. For voice, video, files and more, try <strong>Lotus</strong>.
    </span>
  </a>
</template>

<script setup>
// Small, self-contained attribution. Frames this chat as the light text-only
// option and points people to the full product. Opens the BadgeBox community in
// Lotus (falls back to the Lotus home if no community link is configured).
import { COMMUNITY_CHAT } from '@/config/community'

const lotusLink = COMMUNITY_CHAT.link || 'https://lotus.mybuho.de'
</script>

<style scoped>
.lotus-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  line-height: 1.3;
  color: var(--color-text-subtle);
  text-decoration: none;
  border-top: 1px solid var(--color-border);
  transition: color 0.15s ease;
}

.lotus-footer:hover {
  color: var(--color-text-muted);
}

.lotus-logo {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  object-fit: contain;
  flex-shrink: 0;
}

.lotus-text strong {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
