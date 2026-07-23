<template>
  <button class="community-link" :class="{ 'is-soon': !ready }" @click="open">
    <Icon name="globe" size="xs" class="community-icon" />
    <span class="community-text">{{ ready ? 'Join the ' : '' }}{{ COMMUNITY_CHAT.label }}</span>
    <span v-if="!ready" class="community-soon">Soon</span>
    <Icon v-else name="arrow-right" size="xs" class="community-arrow" />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { COMMUNITY_CHAT, isCommunityChatReady, isExternalCommunityLink } from '@/config/community'
import Icon from '@/components/common/Icon.vue'

// Emitted after a successful navigation, so a parent panel can close itself.
const emit = defineEmits(['navigate'])

const router = useRouter()
const uiStore = useUIStore()

const ready = computed(() => isCommunityChatReady())

function open() {
  const link = COMMUNITY_CHAT.link
  if (!link) {
    uiStore.showInfo('The BadgeBox community chat is coming soon.')
    return
  }
  if (isExternalCommunityLink(link)) {
    window.open(link, '_blank', 'noopener,noreferrer')
  } else {
    router.push(link)
  }
  emit('navigate')
}
</script>

<style scoped>
.community-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-top: 1px solid var(--color-border);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.community-link:hover {
  background: var(--color-primary-soft);
}

.community-icon {
  flex-shrink: 0;
}

.community-arrow {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.community-link:hover .community-arrow {
  transform: translateX(2px);
}

/* Not-yet-available state: muted, with a small "Soon" pill. */
.community-link.is-soon {
  color: var(--color-text-muted);
  cursor: default;
}

.community-link.is-soon:hover {
  background: var(--color-surface-hover);
}

.community-soon {
  flex-shrink: 0;
  padding: 0.0625rem 0.375rem;
  border-radius: var(--radius-full);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-subtle);
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
