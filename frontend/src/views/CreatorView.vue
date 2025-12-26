<template>
  <div class="creator">
    <header class="page-header">
      <h1>✨ Badge Creator</h1>
      <p>Design badges and award them to anyone on Nostr</p>
    </header>
    
    <div class="creator-content">
      <!-- Templates Section -->
      <section class="section">
        <h2>Your Badge Templates</h2>
        <p class="section-desc">Pick a template you've created before, or design a new badge below</p>
        
        <!-- Loading Skeletons -->
        <div v-if="badgesStore.isLoading && !isSubmitting" class="template-grid">
          <div v-for="n in 4" :key="n" class="template-skeleton">
            <div class="skeleton-image"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-desc"></div>
          </div>
        </div>
        
        <!-- Empty State -->
        <div v-else-if="badgesStore.templates.length === 0" class="templates-empty">
          <div class="empty-icon">🎨</div>
          <h3>No templates yet</h3>
          <p>Create your first badge below. Once created, it will appear here for easy re-use.</p>
        </div>
        
        <!-- Templates Grid -->
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
          <h2>{{ selectedTemplate ? 'Award This Badge' : 'Create a New Badge' }}</h2>
          <button 
            v-if="selectedTemplate"
            @click="clearTemplate"
            class="btn-clear-template"
          >
            ✕ Start fresh
          </button>
        </div>
        
        <!-- Template Notice -->
        <div v-if="selectedTemplate" class="template-notice">
          <span class="notice-icon">🔒</span>
          <span>You're using a template. Just add recipients below to award this badge.</span>
        </div>
        
        <!-- Submission Progress -->
        <div v-if="isSubmitting" class="submission-progress">
          <div class="progress-spinner"></div>
          <h3>{{ submissionStatus }}</h3>
          <p>{{ submissionDetail }}</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
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
              <p class="input-hint">A unique ID for this badge (lowercase, no spaces)</p>
            </div>
            <div class="form-group">
              <label for="name">
                Display Name *
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
              <p class="input-hint">The name recipients will see</p>
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
              placeholder="What does this badge represent? Why is it special?"
              :class="['input', 'textarea', { locked: isFieldLocked }]"
              :readonly="isFieldLocked"
              :tabindex="isFieldLocked ? -1 : 0"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="image">
              Badge Image
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
            <p class="input-hint">URL to an image (PNG, JPG, or GIF work best)</p>
          </div>
          
          <div class="form-divider">
            <span>Who gets this badge?</span>
          </div>
          
          <div class="form-group">
            <label for="recipients">Recipients *</label>
            <textarea
              id="recipients"
              v-model="recipientsText"
              placeholder="Paste Nostr public keys here, one per line:&#10;&#10;npub1abc123...&#10;npub1def456..."
              class="input textarea mono"
              rows="5"
              required
            ></textarea>
            <p class="input-hint">
              <span v-if="recipients.length === 0">Enter at least one public key (npub or hex format)</span>
              <span v-else-if="recipients.length === 1">
                <strong>1 person</strong> will receive this badge
              </span>
              <span v-else>
                <strong>{{ recipients.length }} people</strong> will receive this badge
              </span>
            </p>
          </div>
          
          <div class="form-actions">
            <button 
              type="button" 
              @click="resetForm"
              class="btn btn-secondary"
            >
              Clear all
            </button>
            <button 
              type="submit" 
              class="btn btn-primary btn-lg"
              :disabled="!isFormValid"
            >
              🎯 {{ selectedTemplate ? 'Send Badge' : 'Create & Send' }}
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
            <span class="issuer-label">Badges will be issued by</span>
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

const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const uiStore = useUIStore()

const selectedTemplate = ref(null)
const isSubmitting = ref(false)
const submissionStatus = ref('')
const submissionDetail = ref('')
const progressPercent = ref(0)
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
  uiStore.showInfo(`Template "${template.name}" selected. Now just add recipients!`)
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
  progressPercent.value = 10
  submissionStatus.value = 'Creating your badge...'
  submissionDetail.value = 'Setting up the badge definition'
  
  await new Promise(r => setTimeout(r, 500))
  
  progressPercent.value = 30
  submissionStatus.value = 'Publishing to Nostr...'
  submissionDetail.value = 'Connecting to relays around the world'
  
  await new Promise(r => setTimeout(r, 300))
  
  progressPercent.value = 50
  submissionDetail.value = 'This can take up to a minute — hang tight!'
  
  const result = await badgesStore.createAndAwardBadge(form.value, recipients.value)
  
  progressPercent.value = 100
  
  await new Promise(r => setTimeout(r, 200))
  
  isSubmitting.value = false
  progressPercent.value = 0
  
  if (result.success) {
    const count = result.data.recipients_count
    const recipientText = count === 1 ? '1 person' : `${count} people`
    uiStore.showSuccess(`🎉 Success! "${form.value.name}" has been sent to ${recipientText}. They'll see it in their inbox!`)
    resetForm()
    badgesStore.fetchTemplates()
  } else {
    uiStore.showError(result.error || "Something went wrong while creating your badge. Please try again — if it keeps happening, try with fewer recipients.")
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
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.notice-icon {
  font-size: 1rem;
}

/* Templates Empty State */
.templates-empty {
  text-align: center;
  padding: 2rem;
}

.templates-empty .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.templates-empty h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.templates-empty p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 300px;
  margin: 0 auto;
}

/* Template Skeletons */
.template-skeleton {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.template-skeleton .skeleton-image,
.template-skeleton .skeleton-title,
.template-skeleton .skeleton-desc {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.template-skeleton .skeleton-image {
  width: 56px;
  height: 56px;
  margin-bottom: 0.75rem;
}

.template-skeleton .skeleton-title {
  height: 0.875rem;
  width: 70%;
  margin-bottom: 0.5rem;
}

.template-skeleton .skeleton-desc {
  height: 0.75rem;
  width: 90%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Submission Progress */
.submission-progress {
  text-align: center;
  padding: 3rem 2rem;
}

.progress-spinner {
  width: 48px;
  height: 48px;
  margin: 0 auto 1.5rem;
  border: 3px solid var(--color-surface-elevated);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.submission-progress h3 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text);
  font-size: 1.125rem;
}

.submission-progress p {
  color: var(--color-text-muted);
  margin: 0 0 1.5rem 0;
  font-size: 0.875rem;
}

.progress-bar {
  width: 100%;
  max-width: 300px;
  height: 4px;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  margin: 0 auto;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
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
  transform: translateY(-2px);
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
  font-size: 0.8125rem;
  font-weight: 500;
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
