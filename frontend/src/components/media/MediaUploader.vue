<template>
  <div
    class="upload-zone"
    :class="{
      'upload-zone--active': isDragging,
      'upload-zone--disabled': disabled
    }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="openFilePicker"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      multiple
      hidden
      @change="onFileSelect"
    />
    <Icon name="upload" size="md" class="upload-icon" />
    <span class="upload-text">
      Drop files or <span class="upload-link">browse</span>
    </span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Icon from '@/components/common/Icon.vue'

defineProps({
  disabled: { type: Boolean, default: false },
  accept: { type: String, default: 'image/*,video/*,audio/*' }
})

const emit = defineEmits(['upload'])

const fileInput = ref(null)
const isDragging = ref(false)

function onDragOver() {
  isDragging.value = true
}

function onDrop(e) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    emit('upload', e.dataTransfer.files)
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileSelect(e) {
  if (e.target.files?.length) {
    emit('upload', e.target.files)
    e.target.value = ''
  }
}
</script>

<style scoped>
.upload-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all var(--transition-normal);
  background: var(--color-surface);
}

.upload-zone:hover,
.upload-zone--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.upload-zone--active .upload-icon {
  color: var(--color-primary);
}

.upload-zone--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.upload-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: color var(--transition-fast);
}

.upload-text {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  white-space: nowrap;
}

.upload-link {
  color: var(--color-primary);
  text-decoration: underline;
}

/* On mobile, stretch full width */
@media (max-width: 768px) {
  .upload-zone {
    padding: 1rem;
  }
}
</style>
