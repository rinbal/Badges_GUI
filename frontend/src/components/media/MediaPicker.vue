<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="$emit('update:modelValue', false)">
        <div class="picker-modal">
          <!-- Header -->
          <div class="picker-header">
            <h3>Select Media</h3>
            <button class="picker-close" @click="$emit('update:modelValue', false)">
              <Icon name="x" size="sm" />
            </button>
          </div>

          <!-- Tabs -->
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': activeTab === 'library' }"
              @click="activeTab = 'library'"
            >
              <Icon name="photo" size="sm" />
              Library
            </button>
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': activeTab === 'upload' }"
              @click="activeTab = 'upload'"
            >
              <Icon name="upload" size="sm" />
              Upload
            </button>
          </div>

          <!-- Library tab -->
          <div v-if="activeTab === 'library'" class="picker-body">
            <div v-if="mediaStore.isLoading" class="picker-loading">
              <Icon name="loader" size="md" spin />
              <span>Loading...</span>
            </div>
            <div v-else-if="mediaStore.imageFiles.length === 0" class="picker-empty">
              <Icon name="photo-off" size="lg" />
              <p>No images found. Upload one first.</p>
            </div>
            <div v-else class="picker-grid">
              <div
                v-for="file in mediaStore.imageFiles"
                :key="file.hash"
                class="picker-item"
                :class="{ 'picker-item--selected': selected === file.hash }"
                @click="selected = file.hash"
                @dblclick="selectAndClose(file)"
              >
                <img :src="file.url" :alt="file.hash" loading="lazy" />
                <div v-if="selected === file.hash" class="picker-check">
                  <Icon name="check" size="sm" />
                </div>
              </div>
            </div>
          </div>

          <!-- Upload tab -->
          <div v-if="activeTab === 'upload'" class="picker-body">
            <MediaUploader accept="image/*" @upload="onUpload" />
            <div v-if="uploading" class="picker-uploading">
              <Icon name="loader" size="sm" spin />
              <span>Uploading...</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="picker-footer">
            <button class="btn-secondary" @click="$emit('update:modelValue', false)">Cancel</button>
            <button
              class="btn-primary"
              :disabled="!selectedFile"
              @click="confirmSelection"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMediaStore } from '@/stores/media'
import { useBlossom } from '@/composables/useBlossom'
import Icon from '@/components/common/Icon.vue'
import MediaUploader from './MediaUploader.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'select'])

const mediaStore = useMediaStore()
const blossom = useBlossom({ autoFetch: false })

const activeTab = ref('library')
const selected = ref(null)
const uploading = ref(false)

const selectedFile = computed(() => {
  if (!selected.value) return null
  return mediaStore.files.get(selected.value) || null
})

// Fetch when opened
watch(() => props.modelValue, (open) => {
  if (open) {
    selected.value = null
    blossom.refresh()
  }
})

async function onUpload(files) {
  uploading.value = true
  const results = await blossom.uploadFiles(files)
  uploading.value = false

  // Auto-select the first successful upload
  const success = results.find(r => r.success)
  if (success) {
    selected.value = success.result.hash
    activeTab.value = 'library'
  }
}

function selectAndClose(file) {
  emit('select', file.url)
  emit('update:modelValue', false)
}

function confirmSelection() {
  if (selectedFile.value) {
    emit('select', selectedFile.value.url)
    emit('update:modelValue', false)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker-modal {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.picker-header h3 {
  margin: 0;
  color: var(--color-text);
}

.picker-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.picker-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.picker-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.picker-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.picker-tab:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.picker-tab--active {
  color: var(--color-primary);
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.picker-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.picker-loading,
.picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--color-text-muted);
  text-align: center;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

@media (max-width: 600px) {
  .picker-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.picker-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color var(--transition-fast);
}

.picker-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.picker-item:hover {
  border-color: var(--color-border-hover);
}

.picker-item--selected {
  border-color: var(--color-primary);
}

.picker-check {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker-uploading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.picker-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border);
}

.btn-secondary,
.btn-primary {
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
  font-size: 0.875rem;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-surface-hover);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
