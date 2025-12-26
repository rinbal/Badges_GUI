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
        <p class="section-desc">Use a predefined badge template or create a custom one below</p>
        
        <div v-if="badgesStore.isLoading && !isSubmitting" class="loading-state">
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
            <div class="template-check" v-if="selectedTemplate?.identifier === template.identifier">
              ✓
            </div>
            <div class="template-image">
              <img v-if="template.image" :src="template.image" :alt="template.name" @error="handleTemplateImageError" />
              <span v-else class="placeholder">🏅</span>
            </div>
            <div class="template-info">
              <h3>{{ template.name }}</h3>
              <p>{{ template.description || 'No description' }}</p>
            </div>
          </div>
        </div>
      </section>
      
      <!-- Create/Award Form -->
      <section class="section">
        <div class="section-header">
          <h2>{{ selectedTemplate ? 'Award Template Badge' : 'Create Custom Badge' }}</h2>
          <button 
            v-if="selectedTemplate"
            @click="clearTemplate"
            class="btn-clear-template"
          >
            ✕ Clear Template
          </button>
        </div>
        
        <!-- Template Notice -->
        <div v-if="selectedTemplate" class="template-notice">
          <span class="notice-icon">🔒</span>
          <span>Template fields are locked. Only add recipients below.</span>
        </div>
        
        <!-- Submission Progress -->
        <div v-if="isSubmitting" class="submission-progress">
          <LoadingSpinner size="lg" />
          <h3>{{ submissionStatus }}</h3>
          <p>This may take up to a minute while publishing to Nostr relays...</p>
        </div>
        
        <form v-else @submit.prevent="handleSubmit" class="badge-form">
          <div class="form-row">
            <div class="form-group">
              <label for="identifier">
                Identifier *
                <span v-if="selectedTemplate" class="lock-icon">🔒</span>
              </label>
              <input
                id="identifier"
                v-model="form.identifier"
                type="text"
                placeholder="my-awesome-badge"
                :class="['input', { locked: isFieldLocked }]"
                :readonly="isFieldLocked"
                :tabindex="isFieldLocked ? -1 : 0"
                required
              />
              <p class="input-hint">Unique ID (lowercase, no spaces)</p>
            </div>
            <div class="form-group">
              <label for="name">
                Name *
                <span v-if="selectedTemplate" class="lock-icon">🔒</span>
              </label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="My Awesome Badge"
                :class="['input', { locked: isFieldLocked }]"
                :readonly="isFieldLocked"
                :tabindex="isFieldLocked ? -1 : 0"
                required
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="description">
              Description
              <span v-if="selectedTemplate" class="lock-icon">🔒</span>
            </label>
            <textarea
              id="description"
              v-model="form.description"
              placeholder="Describe what this badge represents..."
              :class="['input', 'textarea', { locked: isFieldLocked }]"
              :readonly="isFieldLocked"
              :tabindex="isFieldLocked ? -1 : 0"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="image">
              Image URL
              <span v-if="selectedTemplate" class="lock-icon">🔒</span>
            </label>
            <div class="image-input-row">
              <input
                id="image"
                v-model="form.image"
                type="url"
                placeholder="https://example.com/badge.png"
                :class="['input', { locked: isFieldLocked }]"
                :readonly="isFieldLocked"
                :tabindex="isFieldLocked ? -1 : 0"
              />
              <div v-if="form.image" class="image-preview">
                <img :src="form.image" alt="Badge preview" @error="handlePreviewError" />
              </div>
            </div>
          </div>
          
          <div class="form-divider">
            <span>Recipients</span>
          </div>
          
          <div class="form-group">
            <label for="recipients">Recipients *</label>
            <textarea
              id="recipients"
              v-model="recipientsText"
              placeholder="npub1abc123...&#10;npub1def456...&#10;(one per line)"
              class="input textarea mono"
              rows="4"
              required
            ></textarea>
            <p class="input-hint">
              Enter one public key per line (npub1... or hex format) • 
              <strong>{{ recipients.length }}</strong> recipient(s)
            </p>
          </div>
          
          <div class="form-actions">
            <button 
              type="button" 
              @click="resetForm"
              class="btn btn-secondary"
            >
              Reset All
            </button>
            <button 
              type="submit" 
              class="btn btn-primary btn-lg"
              :disabled="!isFormValid"
            >
              🎯 {{ selectedTemplate ? 'Award Badge' : 'Create & Award Badge' }}
            </button>
          </div>
        </form>
      </section>
      
      <!-- Issuer Info -->
      <section class="section issuer-info">
        <div class="issuer-header">
          <img 
            v-if="authStore.profilePicture" 
            :src="authStore.profilePicture" 
            alt="Your avatar"
            class="issuer-avatar"
          />
          <div v-else class="issuer-avatar-placeholder">👤</div>
          <div class="issuer-details">
            <span class="issuer-label">Issuing as</span>
            <span class="issuer-name">{{ authStore.displayName }}</span>
            <code class="issuer-npub">{{ authStore.shortNpub }}</code>
          </div>
        </div>
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
const submissionStatus = ref('')
const recipientsText = ref('')

const form = ref({
  identifier: '',
  name: '',
  description: '',
  image: ''
})

// Lock fields when template is selected
const isFieldLocked = computed(() => !!selectedTemplate.value)

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

function clearTemplate() {
  selectedTemplate.value = null
  form.value = {
    identifier: '',
    name: '',
    description: '',
    image: ''
  }
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

function handleTemplateImageError(e) {
  e.target.style.display = 'none'
}

function handlePreviewError(e) {
  e.target.style.display = 'none'
}

async function handleSubmit() {
  if (!isFormValid.value) return
  
  isSubmitting.value = true
  submissionStatus.value = '📝 Creating badge definition...'
  
  // Small delay to show UI update
  await new Promise(r => setTimeout(r, 100))
  
  submissionStatus.value = '📡 Publishing to Nostr relays...'
  
  const result = await badgesStore.createAndAwardBadge(form.value, recipients.value)
  
  isSubmitting.value = false
  
  if (result.success) {
    uiStore.showSuccess(`🎉 Badge "${form.value.name}" awarded to ${result.data.recipients_count} recipient(s)!`)
    resetForm()
    badgesStore.fetchTemplates()
  } else {
    uiStore.showError(result.error || 'Failed to create badge. Please try again.')
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
  margin: 0;
}

.section-desc {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 1.25rem 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.btn-clear-template {
  padding: 0.375rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-clear-template:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.template-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.notice-icon {
  font-size: 1rem;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
}

.submission-progress {
  text-align: center;
  padding: 3rem 2rem;
}

.submission-progress h3 {
  margin: 1.5rem 0 0.5rem 0;
  color: var(--color-text);
  font-size: 1.125rem;
}

.submission-progress p {
  color: var(--color-text-muted);
  margin: 0;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.template-card {
  position: relative;
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

.template-check {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: var(--shadow-md);
}

.template-image {
  width: 56px;
  height: 56px;
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
  font-size: 1.75rem;
}

.template-info h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-info p {
  font-size: 0.75rem;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--color-text);
  font-size: 0.9375rem;
}

.lock-icon {
  font-size: 0.75rem;
  opacity: 0.7;
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

.input.locked {
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
  border-style: dashed;
}

.input.locked:focus {
  border-color: var(--color-border);
  box-shadow: none;
}

.input.mono {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 80px;
}

.input-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

.image-input-row {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.image-input-row .input {
  flex: 1;
}

.image-preview {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.form-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-divider::before,
.form-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
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

.btn-lg {
  padding: 0.875rem 2rem;
  font-size: 1rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
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
  opacity: 0.5;
  cursor: not-allowed;
}

.issuer-info {
  background: var(--color-surface-elevated);
}

.issuer-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.issuer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.issuer-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.issuer-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.issuer-label {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.issuer-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.issuer-npub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-primary);
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
