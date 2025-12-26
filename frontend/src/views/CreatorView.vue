<template>
  <div class="creator">
    <header class="page-header">
      <h1>✨ Badge Creator</h1>
      <p>Create and award badges to Nostr users</p>
    </header>
    
    <div class="creator-content">
      <!-- Templates Section -->
      <section class="section">
        <h2>Select Template</h2>
        <div v-if="badgesStore.isLoading" class="loading-state">
          <LoadingSpinner text="Loading templates..." />
        </div>
        <div v-else-if="badgesStore.templates.length === 0" class="empty-state">
          <p>No templates yet. Create your first badge below.</p>
        </div>
        <div v-else class="template-grid">
          <div
            v-for="template in badgesStore.templates"
            :key="template.identifier"
            :class="['template-card', { selected: selectedTemplate?.identifier === template.identifier }]"
            @click="selectTemplate(template)"
          >
            <div class="template-image">
              <img v-if="template.image" :src="template.image" :alt="template.name" />
              <span v-else class="placeholder">🏅</span>
            </div>
            <div class="template-info">
              <h3>{{ template.name }}</h3>
              <p>{{ template.description || 'No description' }}</p>
            </div>
          </div>
        </div>
      </section>
      
      <!-- Create New Template -->
      <section class="section">
        <h2>{{ selectedTemplate ? 'Edit Badge' : 'Create New Badge' }}</h2>
        <form @submit.prevent="handleSubmit" class="badge-form">
          <div class="form-row">
            <div class="form-group">
              <label for="identifier">Identifier *</label>
              <input
                id="identifier"
                v-model="form.identifier"
                type="text"
                placeholder="my-awesome-badge"
                class="input"
                required
              />
            </div>
            <div class="form-group">
              <label for="name">Name *</label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="My Awesome Badge"
                class="input"
                required
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="form.description"
              placeholder="Describe what this badge represents..."
              class="input textarea"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="image">Image URL</label>
            <input
              id="image"
              v-model="form.image"
              type="url"
              placeholder="https://example.com/badge.png"
              class="input"
            />
          </div>
          
          <div class="form-group">
            <label for="recipients">Recipients *</label>
            <textarea
              id="recipients"
              v-model="recipientsText"
              placeholder="Enter npub or hex keys (one per line)"
              class="input textarea"
              rows="4"
              required
            ></textarea>
            <p class="input-hint">Enter one public key per line (npub1... or hex format)</p>
          </div>
          
          <div class="form-actions">
            <button 
              type="button" 
              @click="resetForm"
              class="btn btn-secondary"
            >
              Reset
            </button>
            <button 
              type="submit" 
              class="btn btn-primary"
              :disabled="isSubmitting || !isFormValid"
            >
              <LoadingSpinner v-if="isSubmitting" size="sm" />
              <span v-else>Create & Award Badge</span>
            </button>
          </div>
        </form>
      </section>
      
      <!-- Issuer Info -->
      <section class="section issuer-info">
        <h3>Issuing as</h3>
        <code class="npub">{{ authStore.npub }}</code>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const uiStore = useUIStore()

const selectedTemplate = ref(null)
const isSubmitting = ref(false)
const recipientsText = ref('')

const form = ref({
  identifier: '',
  name: '',
  description: '',
  image: ''
})

const recipients = computed(() => {
  return recipientsText.value
    .split('\n')
    .map(r => r.trim())
    .filter(r => r.length > 0)
})

const isFormValid = computed(() => {
  return form.value.identifier && 
         form.value.name && 
         recipients.value.length > 0
})

onMounted(() => {
  badgesStore.fetchTemplates()
})

function selectTemplate(template) {
  selectedTemplate.value = template
  form.value = { ...template }
}

function resetForm() {
  selectedTemplate.value = null
  form.value = {
    identifier: '',
    name: '',
    description: '',
    image: ''
  }
  recipientsText.value = ''
}

async function handleSubmit() {
  if (!isFormValid.value) return
  
  isSubmitting.value = true
  
  const result = await badgesStore.createAndAwardBadge(form.value, recipients.value)
  
  isSubmitting.value = false
  
  if (result.success) {
    uiStore.showSuccess(`Badge awarded to ${result.data.recipients_count} recipient(s)!`)
    resetForm()
    badgesStore.fetchTemplates()
  } else {
    uiStore.showError(result.error || 'Failed to create badge')
  }
}
</script>

<style scoped>
.creator {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.page-header p {
  color: var(--color-text-muted);
  margin: 0;
}

.section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1.25rem 0;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.template-card {
  background: var(--color-surface-elevated);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: var(--color-primary-soft);
}

.template-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.template-image {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  overflow: hidden;
}

.template-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.template-image .placeholder {
  font-size: 2rem;
}

.template-info h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.template-info p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: var(--color-text);
  font-size: 0.9375rem;
}

.input {
  padding: 0.75rem 1rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.9375rem;
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 80px;
}

.input-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-surface-hover);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.issuer-info {
  background: var(--color-surface-elevated);
}

.issuer-info h3 {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem 0;
}

.npub {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-primary);
  word-break: break-all;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>

