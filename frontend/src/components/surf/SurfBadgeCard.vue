<template>
  <div class="surf-badge-card" @click="$emit('click', badge)">
    <!-- Badge Image -->
    <div class="badge-image-container">
      <img
        v-if="(badge.image || badge.thumb) && !imageError"
        :src="badge.thumb || badge.image"
        :alt="badge.name || 'Badge'"
        class="badge-image"
        @error="handleImageError"
      />
      <div v-else class="badge-placeholder">
        <IconAward :size="40" />
      </div>
    </div>

    <!-- Badge Info -->
    <div class="badge-info">
      <h3 class="badge-name">{{ badge.name || 'Unnamed Badge' }}</h3>
      <p v-if="badge.description" class="badge-description">
        {{ truncatedDescription }}
      </p>
    </div>

    <!-- Badge Meta -->
    <div class="badge-meta">
      <div class="issuer-info">
        <IconUser :size="12" />
        <span>{{ shortIssuer }}</span>
      </div>
      <div v-if="badge.holder_count !== undefined" class="holder-count">
        <IconUsers :size="12" />
        <span>{{ badge.holder_count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { IconAward, IconUser, IconUsers } from '@tabler/icons-vue'

const props = defineProps({
  badge: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click', 'image-error'])

const imageError = ref(false)

const truncatedDescription = computed(() => {
  const desc = props.badge.description || ''
  if (desc.length <= 60) return desc
  return desc.slice(0, 60) + '...'
})

const shortIssuer = computed(() => {
  const npub = props.badge.issuer_npub
  if (npub) {
    return `${npub.slice(0, 8)}...${npub.slice(-4)}`
  }
  const hex = props.badge.issuer_pubkey
  if (hex) {
    return `${hex.slice(0, 6)}...${hex.slice(-4)}`
  }
  return 'Unknown'
})

function handleImageError(e) {
  imageError.value = true
  e.target.style.display = 'none'
  // Notify parent that this badge has a broken image
  emit('image-error', props.badge.a_tag)
}
</script>

<style scoped>
.surf-badge-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.surf-badge-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

/* Badge Image */
.badge-image-container {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-elevated);
}

.badge-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-surface-elevated) 100%);
  color: var(--color-primary);
}

/* Badge Info */
.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.badge-description {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Badge Meta */
.badge-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.issuer-info,
.holder-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.holder-count {
  font-weight: 500;
  color: var(--color-primary);
}
</style>
