<template>
  <div class="media-item" :class="{ 'media-item--selected': isSelected }" @click="$emit('preview', file)">
    <!-- Thumbnail -->
    <div class="media-thumb">
      <img
        v-if="isImage && !thumbError"
        :src="file.url"
        :alt="file.hash"
        loading="lazy"
        @error="thumbError = true"
      />
      <div v-else-if="isVideo" class="media-thumb-placeholder">
        <Icon name="player-play" size="lg" />
      </div>
      <div v-else class="media-thumb-placeholder">
        <Icon name="photo" size="lg" />
      </div>

      <!-- File type badge -->
      <span class="type-badge">{{ fileExtension }}</span>

      <!-- Bottom gradient scrim with info -->
      <div class="media-scrim">
        <span class="scrim-size">{{ formatSize(file.size) }}</span>
        <span v-if="file.created" class="scrim-date">{{ relativeDate(file.created) }}</span>
      </div>

      <!-- Server count indicator -->
      <span v-if="file.servers?.length > 1" class="server-badge" :title="`On ${file.servers.length} servers`">
        <Icon name="server" size="xs" />
        {{ file.servers.length }}
      </span>

      <!-- Hover overlay -->
      <div class="media-overlay" @click.stop>
        <button class="overlay-btn" title="Copy URL" @click="copyUrl">
          <Icon :name="copied ? 'check' : 'copy'" size="sm" />
        </button>
        <button class="overlay-btn" title="Download" @click="$emit('download', file)">
          <Icon name="download" size="sm" />
        </button>
        <button class="overlay-btn" title="Preview" @click="$emit('preview', file)">
          <Icon name="maximize" size="sm" />
        </button>
        <button class="overlay-btn overlay-btn--danger" title="Delete" @click="$emit('delete', file.hash)">
          <Icon name="trash" size="sm" />
        </button>
      </div>

      <!-- Selection checkbox -->
      <label v-if="selectable" class="media-checkbox" @click.stop>
        <input type="checkbox" :checked="isSelected" @change="$emit('toggle', file.hash)" />
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({
  file: { type: Object, required: true },
  selectable: { type: Boolean, default: false },
  isSelected: { type: Boolean, default: false }
})

defineEmits(['preview', 'delete', 'toggle', 'download'])

const thumbError = ref(false)
const copied = ref(false)

const isImage = computed(() => props.file.type?.startsWith('image/'))
const isVideo = computed(() => props.file.type?.startsWith('video/'))

const fileExtension = computed(() => {
  const type = props.file.type || ''
  const ext = type.split('/').pop()?.toUpperCase()
  const map = { JPEG: 'JPG', MPEG: 'MP3', QUICKTIME: 'MOV', 'SVG+XML': 'SVG' }
  return map[ext] || ext || '?'
})

function copyUrl() {
  navigator.clipboard.writeText(props.file.url).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function relativeDate(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.floor(Date.now() / 1000) - timestamp
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`
  return `${Math.floor(seconds / 2592000)}mo`
}
</script>

<style scoped>
.media-item {
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.media-item:hover {
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.media-item--selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

/* Thumbnail container */
.media-thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-bg);
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.media-item:hover .media-thumb img {
  transform: scale(1.05);
}

.media-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-subtle);
}

/* Type badge (top-right) */
.type-badge {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.65);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.625rem;
  font-weight: 600;
  font-family: var(--font-mono);
  border-radius: var(--radius-sm);
  letter-spacing: 0.03em;
  line-height: 1.4;
  backdrop-filter: blur(4px);
  z-index: 2;
}

/* Server count (top-left, below checkbox) */
.server-badge {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.65);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  backdrop-filter: blur(4px);
  z-index: 2;
}

/* Bottom gradient scrim */
.media-scrim {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 1.5rem 0.5rem 0.375rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.85);
  z-index: 1;
  pointer-events: none;
}

.scrim-size {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.scrim-date {
  opacity: 0.7;
}

/* Hover overlay */
.media-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
  z-index: 3;
}

.media-item:hover .media-overlay {
  opacity: 1;
}

.overlay-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.overlay-btn:hover {
  background: var(--color-surface-hover);
}

.overlay-btn--danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Selection checkbox */
.media-checkbox {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  cursor: pointer;
  z-index: 4;
}

.media-checkbox input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-primary);
}

/* On mobile: always show scrim, never show hover overlay */
@media (hover: none) {
  .media-scrim {
    opacity: 1;
  }

  .media-overlay {
    /* Tap targets at bottom instead of overlay */
    opacity: 0;
    pointer-events: none;
  }
}
</style>
