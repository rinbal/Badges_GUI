<template>
  <!--
    CollectionBadgeCard
    Compact card for displaying badges in the collection grid.
    Designed for visual impact in a masonry-style layout.
  -->
  <article class="collection-card" @click="$emit('click', badge)">
    <!-- Badge Image (Featured) -->
    <div class="card-image">
      <img v-if="badgeImage" :src="badgeImage" :alt="badgeName" @error="onImageError" />
      <span v-else class="placeholder">🏅</span>

      <!-- Hover Overlay -->
      <div class="card-overlay">
        <span class="view-label">View Details</span>
      </div>
    </div>

    <!-- Card Body -->
    <div class="card-body">
      <h3 class="card-title">{{ badgeName }}</h3>

      <!-- Issuer Row -->
      <div class="card-issuer">
        <img v-if="issuerPicture" :src="issuerPicture" class="issuer-pic" @error="onAvatarError" />
        <span v-else class="issuer-pic placeholder">👤</span>
        <span class="issuer-name">{{ issuerName }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
/**
 * CollectionBadgeCard Component
 *
 * Compact, visually-focused card for the badge collection grid.
 * Prioritizes the badge image with minimal text.
 */

import { ref, computed } from 'vue'

const props = defineProps({
  badge: { type: Object, required: true }
})

defineEmits(['click'])

// Image error states
const imageError = ref(false)
const avatarError = ref(false)

// Computed properties
const badgeName = computed(() => props.badge.badge_name || props.badge.name || 'Unknown Badge')
const badgeImage = computed(() => imageError.value ? null : (props.badge.badge_image || props.badge.image))
const issuerPicture = computed(() => avatarError.value ? null : props.badge.issuer_picture)
const issuerName = computed(() => props.badge.issuer_name || 'Unknown')

function onImageError() { imageError.value = true }
function onAvatarError() { avatarError.value = true }
</script>

<style scoped>
.collection-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.collection-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Card Image */
.card-image {
  position: relative;
  aspect-ratio: 1;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.collection-card:hover .card-image img {
  transform: scale(1.05);
}

.card-image .placeholder {
  font-size: 3rem;
}

/* Hover Overlay */
.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.collection-card:hover .card-overlay {
  opacity: 1;
}

.view-label {
  padding: 0.5rem 1rem;
  background: white;
  color: var(--color-bg);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
}

/* Card Body */
.card-body {
  padding: 0.875rem;
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Issuer */
.card-issuer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.issuer-pic {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.issuer-pic.placeholder {
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
}

.issuer-name {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
