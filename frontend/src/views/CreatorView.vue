<template>
  <div class="creator">
    <!-- Header -->
    <header class="page-header">
      <h1>✨ Badge Creator</h1>
      <p>Design and award badges to anyone on Nostr</p>
    </header>

    <div class="main-layout">
      <!-- Left: Form -->
      <div class="form-column">
        <section class="card">
          <div class="card-header">
            <h2>{{ formTitle }}</h2>
            <button v-if="selectedAppTemplate" @click="clearAppTemplate" class="clear-btn">
              ✕ Clear
            </button>
          </div>

          <!-- App Template Notice -->
          <div v-if="selectedAppTemplate" class="notice info">
            🔒 Using app template — fields are locked. Add recipients below.
          </div>

          <!-- Progress -->
          <div v-if="isSubmitting" class="progress-state">
            <div class="spinner"></div>
            <strong>{{ submissionStatus }}</strong>
            <p>{{ submissionDetail }}</p>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
          </div>

          <!-- Form -->
          <form v-else @submit.prevent="handleSubmit" class="form">
            <div class="form-row">
              <div class="field">
                <label>
                  Identifier *
                  <span v-if="selectedAppTemplate" class="lock">🔒</span>
                </label>
                <input
                  v-model="form.identifier"
                  type="text"
                  placeholder="my-badge"
                  :readonly="!!selectedAppTemplate"
                  :class="{ locked: !!selectedAppTemplate }"
                  required
                />
                <small>Unique ID (lowercase, no spaces)</small>
              </div>
              <div class="field">
                <label>
                  Name *
                  <span v-if="selectedAppTemplate" class="lock">🔒</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="My Badge"
                  :readonly="!!selectedAppTemplate"
                  :class="{ locked: !!selectedAppTemplate }"
                  required
                />
                <small>Display name</small>
              </div>
            </div>

            <div class="field">
              <label>
                Description
                <span v-if="selectedAppTemplate" class="lock">🔒</span>
              </label>
              <textarea
                v-model="form.description"
                placeholder="What does this badge represent?"
                :readonly="!!selectedAppTemplate"
                :class="{ locked: !!selectedAppTemplate }"
                rows="2"
              ></textarea>
            </div>

            <div class="field">
              <label>
                Image URL
                <span v-if="selectedAppTemplate" class="lock">🔒</span>
              </label>
              <div class="image-field">
                <input
                  v-model="form.image"
                  type="url"
                  placeholder="https://..."
                  :readonly="!!selectedAppTemplate"
                  :class="{ locked: !!selectedAppTemplate }"
                />
                <div v-if="form.image" class="image-preview">
                  <img :src="form.image" alt="" @error="handleImageError" />
                </div>
              </div>
            </div>

            <div class="divider"><span>Recipients</span></div>

            <div class="field">
              <label>Receiver of this badge *</label>
              <textarea
                v-model="recipientsText"
                placeholder="Paste npubs, one per line..."
                class="mono"
                rows="4"
              ></textarea>
              <small>
                <template v-if="recipients.length === 0">Enter at least one npub</template>
                <template v-else>
                  <strong>{{ recipients.length }}</strong> recipient{{ recipients.length !== 1 ? 's' : '' }}
                </template>
              </small>
            </div>

            <div class="form-actions">
              <button
                v-if="!selectedAppTemplate && canSaveAsTemplate"
                type="button"
                @click="saveAsTemplate"
                class="btn secondary"
                :disabled="isSaving"
              >
                💾 {{ isSaving ? 'Saving...' : 'Save as Template' }}
              </button>
              <div class="spacer"></div>
              <button type="button" @click="resetForm" class="btn secondary">Clear</button>
              <button type="submit" class="btn primary" :disabled="!canSubmit">
                🎯 {{ selectedAppTemplate ? 'Award Badge' : 'Create & Award' }}
              </button>
            </div>
          </form>
        </section>

        <!-- Issuer -->
        <section class="card issuer-card">
          <img v-if="authStore.profilePicture" :src="authStore.profilePicture" class="avatar" />
          <div v-else class="avatar placeholder">👤</div>
          <div class="issuer-info">
            <small>Issuing as</small>
            <strong>{{ authStore.displayName }}</strong>
            <code>{{ authStore.shortNpub }}</code>
          </div>
        </section>
      </div>

      <!-- Right: Templates -->
      <div class="templates-column">
        <!-- App Templates -->
        <section class="card">
          <h3>🏅 App Templates</h3>
          <p class="card-desc">Official badges — click to use</p>

          <div class="app-templates">
            <button
              v-for="t in APP_TEMPLATES"
              :key="t.identifier"
              :class="['app-template', { selected: selectedAppTemplate?.identifier === t.identifier }]"
              @click="selectAppTemplate(t)"
            >
              <img :src="t.image" :alt="t.name" class="template-thumb" />
              <div class="template-details">
                <strong>{{ t.name }}</strong>
                <span>{{ t.description }}</span>
              </div>
              <div v-if="selectedAppTemplate?.identifier === t.identifier" class="check">✓</div>
            </button>
          </div>
        </section>

        <!-- User Templates -->
        <section class="card">
          <div class="card-header">
            <div>
              <h3>📁 Your Templates</h3>
              <p class="card-desc">Your saved designs</p>
            </div>
            <button @click="refreshTemplates" class="icon-btn" :disabled="isLoadingTemplates">
              <span :class="{ spin: isLoadingTemplates }">🔄</span>
            </button>
          </div>

          <!-- Search -->
          <div v-if="badgesStore.templates.length > 2" class="search-field">
            <input v-model="searchQuery" type="text" placeholder="Search..." />
            <button v-if="searchQuery" @click="searchQuery = ''" class="clear-search">✕</button>
          </div>

          <!-- States -->
          <div v-if="isLoadingTemplates" class="template-list">
            <div v-for="n in 2" :key="n" class="skeleton-item">
              <div class="skel-thumb"></div>
              <div class="skel-text"></div>
            </div>
          </div>

          <div v-else-if="badgesStore.templates.length === 0" class="empty-state">
            <span>📁</span>
            <p>No templates yet</p>
          </div>

          <div v-else-if="filteredTemplates.length === 0" class="empty-state">
            <span>🔍</span>
            <p>No matches</p>
          </div>

          <div v-else class="template-list">
            <button
              v-for="t in filteredTemplates"
              :key="t.identifier"
              :class="['user-template', { selected: selectedUserTemplate?.identifier === t.identifier }]"
              @click="selectUserTemplate(t)"
            >
              <img v-if="t.image" :src="t.image" :alt="t.name" class="template-thumb" @error="hideImage" />
              <span v-else class="template-thumb placeholder">🏅</span>
              <div class="template-details">
                <strong>{{ t.name }}</strong>
                <span>{{ t.description || 'No description' }}</span>
              </div>
              <div v-if="selectedUserTemplate?.identifier === t.identifier" class="check">✓</div>
              <button @click.stop="deleteTemplate(t)" class="delete-btn">🗑️</button>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'

// ============================================
// CONSTANTS
// ============================================

// App's official templates (from JSON files)
const APP_TEMPLATES = Object.freeze([
  {
    identifier: 'badgecreator',
    name: 'Badge Creator',
    description: 'Creator of a custom nostr badge',
    image: 'https://raw.githubusercontent.com/rinbal/nostr-badges/main/images/badgecreator_v03.png'
  },
  {
    identifier: 'nostruser',
    name: 'Nostr User',
    description: 'Nostr user :)',
    image: 'https://raw.githubusercontent.com/rinbal/nostr-badges/main/images/nostruser_v01.png'
  }
])

// ============================================
// STORES
// ============================================

const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const uiStore = useUIStore()

// ============================================
// STATE
// ============================================

// Template selection (mutually exclusive)
const selectedAppTemplate = ref(null)
const selectedUserTemplate = ref(null)

// Form
const form = ref({ identifier: '', name: '', description: '', image: '' })
const recipientsText = ref('')

// UI state
const searchQuery = ref('')
const isSubmitting = ref(false)
const isSaving = ref(false)
const submissionStatus = ref('')
const submissionDetail = ref('')
const progressPercent = ref(0)

// ============================================
// COMPUTED
// ============================================

const isLoadingTemplates = computed(() => badgesStore.isLoading && !isSubmitting.value)

const formTitle = computed(() => {
  if (selectedAppTemplate.value) return `Award: ${selectedAppTemplate.value.name}`
  if (selectedUserTemplate.value) return `Award: ${selectedUserTemplate.value.name}`
  return 'Create Badge'
})

const filteredTemplates = computed(() => {
  if (!searchQuery.value.trim()) return badgesStore.templates
  const q = searchQuery.value.toLowerCase()
  return badgesStore.templates.filter(t => t.name?.toLowerCase().includes(q))
})

const recipients = computed(() =>
  recipientsText.value.split('\n').map(r => r.trim()).filter(Boolean)
)

const canSaveAsTemplate = computed(() =>
  form.value.identifier?.trim() && form.value.name?.trim()
)

const canSubmit = computed(() =>
  form.value.identifier?.trim() && form.value.name?.trim() && recipients.value.length > 0
)

// ============================================
// METHODS: Template Selection
// ============================================

function selectAppTemplate(template) {
  // Clear user template, select app template
  selectedUserTemplate.value = null
  selectedAppTemplate.value = template
  form.value = { ...template }
  uiStore.showInfo(`"${template.name}" selected`)
}

function clearAppTemplate() {
  selectedAppTemplate.value = null
  form.value = { identifier: '', name: '', description: '', image: '' }
}

function selectUserTemplate(template) {
  // Clear app template, select user template
  selectedAppTemplate.value = null
  selectedUserTemplate.value = template
  form.value = { ...template }
  uiStore.showInfo(`Template "${template.name}" loaded`)
}

function clearUserTemplate() {
  selectedUserTemplate.value = null
  form.value = { identifier: '', name: '', description: '', image: '' }
}

// ============================================
// METHODS: Form Actions
// ============================================

function resetForm() {
  selectedAppTemplate.value = null
  selectedUserTemplate.value = null
  form.value = { identifier: '', name: '', description: '', image: '' }
  recipientsText.value = ''
}

async function saveAsTemplate() {
  if (!canSaveAsTemplate.value) return

  isSaving.value = true
  const result = await badgesStore.createTemplate({ ...form.value })
  isSaving.value = false

  if (result.success) {
    uiStore.showSuccess(`"${form.value.name}" saved!`)
  } else {
    uiStore.showError(result.error || 'Failed to save')
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  progressPercent.value = 10
  submissionStatus.value = 'Creating badge...'
  submissionDetail.value = 'Preparing'

  await sleep(400)
  progressPercent.value = 40
  submissionStatus.value = 'Publishing...'
  submissionDetail.value = 'Connecting to relays'

  await sleep(300)
  progressPercent.value = 60
  submissionDetail.value = 'This may take a moment'

  const result = await badgesStore.createAndAwardBadge(form.value, recipients.value)
  progressPercent.value = 100

  await sleep(200)
  isSubmitting.value = false
  progressPercent.value = 0

  if (result.success) {
    const n = result.data.recipients_count
    uiStore.showSuccess(`🎉 "${form.value.name}" sent to ${n} ${n === 1 ? 'person' : 'people'}!`)
    resetForm()
    badgesStore.fetchTemplates()
  } else {
    uiStore.showError(result.error || 'Something went wrong')
  }
}

// ============================================
// METHODS: User Templates
// ============================================

function refreshTemplates() {
  badgesStore.fetchTemplates()
}

async function deleteTemplate(template) {
  if (!confirm(`Delete "${template.name}"?`)) return

  const result = await badgesStore.deleteTemplate(template.identifier)
  if (result.success) {
    uiStore.showSuccess('Deleted')
    if (selectedUserTemplate.value?.identifier === template.identifier) {
      clearUserTemplate()
    }
  } else {
    uiStore.showError(result.error || 'Failed to delete')
  }
}

// ============================================
// METHODS: Utilities
// ============================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function handleImageError(e) {
  e.target.style.display = 'none'
}

function hideImage(e) {
  e.target.style.display = 'none'
}

// ============================================
// LIFECYCLE
// ============================================

onMounted(() => {
  badgesStore.fetchTemplates()
})
</script>

<style scoped>
.creator {
  max-width: 1100px;
  margin: 0 auto;
}

/* Header */
.page-header {
  margin-bottom: 1.5rem;
}
.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}
.page-header p {
  color: var(--color-text-muted);
  margin: 0;
}

/* Layout */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.templates-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Card */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
}

.card h2 {
  font-size: 1.125rem;
  margin: 0;
}

.card h3 {
  font-size: 1rem;
  margin: 0;
}

.card-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0.125rem 0 0;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

/* Buttons */
.clear-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}
.clear-btn:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
}
.icon-btn:hover:not(:disabled) { border-color: var(--color-primary); }
.icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn.primary {
  background: var(--color-primary);
  color: white;
}
.btn.primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn.secondary {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
.btn.secondary:hover:not(:disabled) { background: var(--color-surface-hover); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Notice */
.notice {
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  font-size: 0.8125rem;
}
.notice.info {
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
}

/* Form */
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field label {
  font-size: 0.8125rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.lock {
  font-size: 0.625rem;
  opacity: 0.6;
}

.field input,
.field textarea {
  padding: 0.625rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--color-text);
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

.field input.locked,
.field textarea.locked {
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
  border-style: dashed;
}

.field small {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.mono {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.image-field {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.image-field input { flex: 1; }

.image-preview {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface);
  flex-shrink: 0;
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  margin: 0.25rem 0;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
}
.spacer { flex: 1; }

/* Progress */
.progress-state {
  text-align: center;
  padding: 2rem;
}
.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.progress-state strong { display: block; margin-bottom: 0.25rem; }
.progress-state p {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  margin: 0 0 1rem;
}
.progress-track {
  height: 4px;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
  max-width: 260px;
  margin: 0 auto;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}

/* Issuer */
.issuer-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-surface-elevated);
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.avatar.placeholder {
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}
.issuer-info small {
  font-size: 0.625rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.issuer-info strong { display: block; font-size: 0.9375rem; }
.issuer-info code {
  font-size: 0.6875rem;
  color: var(--color-primary);
}

/* App Templates */
.app-templates {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.app-template {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.app-template:hover { border-color: var(--color-primary-soft); }
.app-template.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

/* User Templates */
.search-field {
  position: relative;
  margin-bottom: 0.75rem;
}
.search-field input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  padding-right: 2rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--color-text);
}
.search-field input:focus {
  outline: none;
  border-color: var(--color-primary);
}
.clear-search {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.75rem;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-template {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  background: var(--color-surface-elevated);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.user-template:hover { border-color: var(--color-primary-soft); }
.user-template.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.delete-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  opacity: 0;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
}
.user-template:hover .delete-btn { opacity: 0.5; }
.delete-btn:hover {
  opacity: 1 !important;
  background: var(--color-danger-soft);
}

/* Template Common */
.template-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-surface);
}
.template-thumb.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.template-details {
  flex: 1;
  min-width: 0;
}
.template-details strong {
  display: block;
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.template-details span {
  display: block;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check {
  width: 20px;
  height: 20px;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* Skeleton */
.skeleton-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
}
.skel-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-surface-hover) 50%, var(--color-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.skel-text {
  flex: 1;
  height: 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-surface-hover) 50%, var(--color-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty */
.empty-state {
  text-align: center;
  padding: 1.25rem;
  color: var(--color-text-muted);
}
.empty-state span {
  font-size: 1.5rem;
  display: block;
  margin-bottom: 0.375rem;
}
.empty-state p {
  margin: 0;
  font-size: 0.75rem;
}

/* Responsive */
@media (max-width: 800px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  .templates-column {
    order: -1;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
