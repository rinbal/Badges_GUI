<template>
  <div class="creator">
    <!-- Header -->
    <header class="page-header">
      <h1>Badge Creator</h1>
      <p class="subtitle">Create and award badges to anyone on Nostr</p>
    </header>

    <!-- Mode Selection -->
    <section v-if="!activeMode" class="mode-selection animate-fadeIn">
      <h2 class="section-title">What would you like to do?</h2>
      <p class="section-hint">Start by choosing a badge type below</p>

      <div class="mode-cards">
        <button class="mode-card" @click="selectMode('award')">
          <div class="mode-icon official">
            <Icon name="award" size="lg" />
          </div>
          <div class="mode-content">
            <h3>Award an Official Badge</h3>
            <p>Pick from ready-made badges - perfect for quick awards</p>
            <span class="mode-badge">{{ appTemplateCount }} available</span>
          </div>
          <Icon name="chevron-right" size="md" class="mode-arrow" />
        </button>

        <button class="mode-card" @click="selectMode('create')">
          <div class="mode-icon custom">
            <Icon name="sparkles" size="lg" />
          </div>
          <div class="mode-content">
            <h3>Create a Custom Badge</h3>
            <p>Design your own badge with custom name, image & description</p>
            <span class="mode-badge">Unlimited</span>
          </div>
          <Icon name="chevron-right" size="md" class="mode-arrow" />
        </button>
      </div>

      <!-- User Templates Shortcut -->
      <button
        v-if="badgesStore.userTemplateCount > 0"
        class="templates-shortcut"
        @click="selectMode('templates')"
      >
        <Icon name="template" size="md" class="shortcut-icon" />
        <span class="shortcut-text">
          You have <strong>{{ badgesStore.userTemplateCount }}</strong> saved template{{ badgesStore.userTemplateCount !== 1 ? 's' : '' }}
        </span>
        <Icon name="chevron-right" size="sm" class="shortcut-arrow" />
      </button>
    </section>

    <!-- Award Official Badge -->
    <section v-else-if="activeMode === 'award'" class="workflow animate-fadeIn">
      <header class="workflow-header">
        <button class="back-btn" @click="goBack" title="Go back">
          <Icon name="arrow-left" size="sm" />
        </button>
        <div class="workflow-title">
          <h2>Award an Official Badge</h2>
          <p>Select a badge, then choose recipients</p>
        </div>
      </header>

      <div class="workflow-body">
        <!-- Step 1: Select Badge -->
        <div class="step">
          <div class="step-header">
            <div class="step-indicator" :class="stepClass(1)">
              <Icon v-if="selectedTemplate" name="check" size="xs" />
              <span v-else>1</span>
            </div>
            <div class="step-info">
              <h3>Choose a Badge</h3>
              <p v-if="!selectedTemplate">Select the badge you want to award</p>
              <p v-else class="step-done">{{ selectedTemplate.name }} selected</p>
            </div>
          </div>

          <div class="badges-grid">
            <button
              v-for="template in badgesStore.appTemplates"
              :key="template.identifier"
              :class="['badge-card', { selected: selectedTemplate?.identifier === template.identifier }]"
              @click="selectTemplate(template)"
            >
              <div class="badge-image">
                <img :src="template.image" :alt="template.name" @error="onImageError" />
              </div>
              <div class="badge-details">
                <strong>{{ template.name }}</strong>
                <span>{{ template.description }}</span>
              </div>
              <div v-if="selectedTemplate?.identifier === template.identifier" class="badge-check">
                <Icon name="check" size="xs" />
              </div>
            </button>
          </div>
        </div>

        <!-- Step 2: Add Recipients -->
        <div class="step" :class="{ 'step-disabled': !selectedTemplate }">
          <div class="step-header">
            <div class="step-indicator" :class="stepClass(2)">
              <Icon v-if="recipients.length > 0" name="check" size="xs" />
              <span v-else>2</span>
            </div>
            <div class="step-info">
              <h3>Add Recipients</h3>
              <p v-if="recipients.length === 0">Enter the Nostr users who will receive this badge</p>
              <p v-else class="step-done">{{ recipientSummary }}</p>
            </div>
          </div>

          <RecipientInput
            v-model="recipientsText"
            :disabled="!selectedTemplate"
            :count="recipients.length"
            @update:modelValue="onRecipientsChange"
          />
        </div>

        <!-- Step 3: Confirm & Award -->
        <div class="step step-final" :class="{ 'step-disabled': !canSubmit }">
          <div class="step-header">
            <div class="step-indicator" :class="stepClass(3)">3</div>
            <div class="step-info">
              <h3>Confirm & Award</h3>
              <p>Review and publish the badge</p>
            </div>
          </div>

          <div class="confirm-panel">
            <div v-if="selectedTemplate" class="confirm-preview">
              <img :src="selectedTemplate.image" :alt="selectedTemplate.name" class="preview-image" @error="onImageError" />
              <div class="preview-info">
                <strong>{{ selectedTemplate.name }}</strong>
                <span>{{ selectedTemplate.description }}</span>
              </div>
            </div>

            <div class="confirm-meta">
              <div class="meta-item">
                <span class="meta-label">Recipients</span>
                <span class="meta-value">{{ recipients.length || '—' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Issuer</span>
                <span class="meta-value issuer">
                  <img v-if="authStore.profilePicture" :src="authStore.profilePicture" class="issuer-pic" />
                  {{ authStore.displayName }}
                </span>
              </div>
            </div>

            <button
              class="btn-submit"
              :disabled="!canSubmit || isSubmitting"
              @click="handleSubmit"
            >
              <span v-if="isSubmitting" class="btn-spinner"></span>
              <span>{{ isSubmitting ? 'Awarding...' : 'Award Badge' }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Create Custom Badge -->
    <section v-else-if="activeMode === 'create'" class="workflow animate-fadeIn">
      <header class="workflow-header">
        <button class="back-btn" @click="goBack" title="Go back">
          <Icon name="arrow-left" size="sm" />
        </button>
        <div class="workflow-title">
          <h2>{{ editingTemplate ? 'Edit Template' : 'Create a Custom Badge' }}</h2>
          <p>{{ editingTemplate ? 'Update template details' : 'Design your badge, then award it' }}</p>
        </div>
      </header>

      <div class="create-layout">
        <form @submit.prevent="handleSubmit" class="create-form">
          <!-- Badge ID -->
          <div class="form-group">
            <label for="identifier">Badge ID <span class="required">*</span></label>
            <input
              id="identifier"
              v-model="form.identifier"
              type="text"
              placeholder="e.g. early-supporter"
              :class="{ 'has-error': identifierError, 'readonly': editingTemplate }"
              :readonly="!!editingTemplate"
              @input="validateIdentifier"
              maxlength="64"
            />
            <p v-if="identifierError" class="field-error">{{ identifierError }}</p>
            <p v-else-if="editingTemplate" class="field-hint">Badge ID cannot be changed when editing.</p>
            <p v-else class="field-hint">Lowercase, numbers, hyphens. This is the unique identifier.</p>
          </div>

          <!-- Badge Name -->
          <div class="form-group">
            <label for="name">Badge Name <span class="required">*</span></label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              placeholder="e.g. Early Supporter"
              maxlength="100"
            />
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="form.description"
              placeholder="What does this badge represent?"
              rows="2"
              maxlength="500"
            ></textarea>
          </div>

          <!-- Image URL -->
          <div class="form-group">
            <label for="image">Image URL</label>
            <div class="input-with-preview">
              <input
                id="image"
                v-model="form.image"
                type="url"
                placeholder="https://..."
              />
              <div v-if="form.image" class="input-preview">
                <img :src="form.image" @error="onImageError" />
              </div>
            </div>
            <p class="field-hint">Direct link to badge image (PNG, JPG, GIF)</p>
          </div>

          <template v-if="!editingTemplate">
            <div class="form-divider"></div>

            <!-- Recipients -->
            <div class="form-group">
              <label>Recipients <span class="required">*</span></label>
              <RecipientInput
                v-model="recipientsText"
                :count="recipients.length"
                @update:modelValue="onRecipientsChange"
              />
            </div>
          </template>

          <!-- Actions -->
          <div class="form-actions">
            <template v-if="editingTemplate">
              <button
                type="button"
                class="btn-secondary"
                @click="cancelEdit"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn-primary"
                :disabled="!canSaveTemplate || isUpdating"
                @click="updateTemplateChanges"
              >
                <span v-if="isUpdating" class="btn-spinner"></span>
                {{ isUpdating ? 'Updating...' : 'Update Template' }}
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="btn-secondary"
                :disabled="!canSaveTemplate || isSaving"
                @click="saveAsTemplate"
              >
                <span v-if="isSaving" class="btn-spinner dark"></span>
                {{ isSaving ? 'Saving...' : 'Save as Template' }}
              </button>
              <button
                type="submit"
                class="btn-primary"
                :disabled="!canSubmit || isSubmitting"
              >
                <span v-if="isSubmitting" class="btn-spinner"></span>
                {{ isSubmitting ? 'Creating...' : 'Create & Award' }}
              </button>
            </template>
          </div>
        </form>

        <!-- Sidebar -->
        <aside class="create-sidebar">
          <div class="sidebar-card">
            <img v-if="authStore.profilePicture" :src="authStore.profilePicture" class="sidebar-avatar" />
            <div v-else class="sidebar-avatar placeholder">
              <Icon name="user" size="md" />
            </div>
            <div class="sidebar-info">
              <span class="sidebar-label">Creating as</span>
              <strong>{{ authStore.displayName }}</strong>
              <code>{{ authStore.shortNpub }}</code>
            </div>
          </div>
          <div class="sidebar-tip">
            <Icon name="info" size="sm" class="tip-icon" />
            <div>
              <strong>{{ editingTemplate ? 'Editing mode' : 'Pro tip' }}</strong>
              <p v-if="editingTemplate">Update the badge details and click "Update Template" to save changes.</p>
              <p v-else>Save as template to quickly award this badge again in the future.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <!-- User Templates -->
    <section v-else-if="activeMode === 'templates'" class="workflow animate-fadeIn">
      <header class="workflow-header">
        <button class="back-btn" @click="goBack" title="Go back">
          <Icon name="arrow-left" size="sm" />
        </button>
        <div class="workflow-title">
          <h2>Your Templates</h2>
          <p>Saved badge designs for quick reuse</p>
        </div>
        <button class="refresh-btn" @click="refreshTemplates" :disabled="isLoadingTemplates" title="Refresh">
          <Icon name="refresh" size="sm" :spin="isLoadingTemplates" />
        </button>
      </header>

      <!-- Loading -->
      <div v-if="isLoadingTemplates" class="templates-grid">
        <div v-for="n in 3" :key="n" class="template-skeleton">
          <div class="skel-image"></div>
          <div class="skel-body">
            <div class="skel-line"></div>
            <div class="skel-line short"></div>
            <div class="skel-line shorter"></div>
          </div>
          <div class="skel-actions">
            <div class="skel-btn"></div>
            <div class="skel-btn"></div>
            <div class="skel-btn"></div>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="badgesStore.userTemplateCount === 0" class="empty-state">
        <div class="empty-icon">
          <Icon name="template" size="xl" />
        </div>
        <h3>No saved templates</h3>
        <p>Create a custom badge and save it as a template for quick access.</p>
        <button class="btn-primary" @click="selectMode('create')">
          <Icon name="create" size="sm" />
          <span>Create a Badge</span>
        </button>
      </div>

      <!-- Templates Grid -->
      <div v-else class="templates-grid">
        <div v-for="template in badgesStore.templates" :key="template.identifier" class="template-item">
          <div class="template-image">
            <img v-if="template.image" :src="template.image" :alt="template.name" @error="onImageError" />
            <div v-else class="template-placeholder">
              <Icon name="award" size="lg" />
            </div>
          </div>
          <div class="template-body">
            <h4>{{ template.name }}</h4>
            <p>{{ template.description || 'No description' }}</p>
            <code>{{ template.identifier }}</code>
          </div>
          <div class="template-actions">
            <button class="btn-action primary" @click="useTemplate(template)">Award</button>
            <button class="btn-action secondary" @click="editTemplate(template)">Edit</button>
            <button class="btn-action danger" @click="deleteTemplate(template)">Delete</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Progress Overlay -->
    <Transition name="fade">
      <div v-if="isSubmitting" class="progress-overlay">
        <div class="progress-modal">
          <div class="progress-spinner"></div>
          <h3>{{ progressStatus }}</h3>
          <p>{{ progressDetail }}</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'
import RecipientInput from '@/components/common/RecipientInput.vue'
import Icon from '@/components/common/Icon.vue'

const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const uiStore = useUIStore()

// Navigation
const activeMode = ref(null)

// Template selection
const selectedTemplate = ref(null)

// Editing state
const editingTemplate = ref(null)
const isUpdating = ref(false)

// Form
const form = ref({ identifier: '', name: '', description: '', image: '' })
const identifierError = ref('')

// Recipients
const recipientsText = ref('')

// Loading states
const isSubmitting = ref(false)
const isSaving = ref(false)
const progressStatus = ref('')
const progressDetail = ref('')
const progressPercent = ref(0)

// Computed
const appTemplateCount = computed(() => badgesStore.appTemplates.length)
const isLoadingTemplates = computed(() => badgesStore.isLoading && !isSubmitting.value)

const recipients = computed(() =>
  recipientsText.value
    .split(/[\n,]/)
    .map(r => r.trim())
    .filter(r => r.startsWith('npub1') && r.length === 63)
)

const recipientSummary = computed(() => {
  const count = recipients.value.length
  if (count === 0) return ''
  if (count === 1) return '1 recipient ready'
  return `${count} recipients ready`
})

const canSaveTemplate = computed(() =>
  form.value.identifier?.trim() &&
  form.value.name?.trim() &&
  !identifierError.value
)

const canSubmit = computed(() => {
  if (recipients.value.length === 0) return false

  if (activeMode.value === 'award') {
    return !!selectedTemplate.value
  }
  if (activeMode.value === 'create') {
    return form.value.identifier?.trim() && form.value.name?.trim() && !identifierError.value
  }
  return false
})

// Step indicator class
function stepClass(step) {
  if (activeMode.value === 'award') {
    if (step === 1) return selectedTemplate.value ? 'done' : 'active'
    if (step === 2) return recipients.value.length > 0 ? 'done' : (selectedTemplate.value ? 'active' : '')
    if (step === 3) return canSubmit.value ? 'active' : ''
  }
  return ''
}

// Navigation
function selectMode(mode) {
  activeMode.value = mode
  resetState()
  if (mode === 'templates') {
    badgesStore.fetchAllTemplates()
  }
  if (mode === 'award') {
    uiStore.showInfo('Select a badge to get started')
  }
}

function goBack() {
  activeMode.value = null
  resetState()
}

function resetState() {
  selectedTemplate.value = null
  editingTemplate.value = null
  form.value = { identifier: '', name: '', description: '', image: '' }
  recipientsText.value = ''
  identifierError.value = ''
}

// Template selection
function selectTemplate(template) {
  selectedTemplate.value = template
  uiStore.showInfo(`${template.name} selected — now add recipients`)
}

function useTemplate(template) {
  form.value = {
    identifier: template.identifier,
    name: template.name,
    description: template.description || '',
    image: template.image || ''
  }
  selectedTemplate.value = template
  editingTemplate.value = null
  activeMode.value = 'award'
  uiStore.showInfo(`Using "${template.name}" — add recipients to award`)
}

function editTemplate(template) {
  form.value = {
    identifier: template.identifier,
    name: template.name,
    description: template.description || '',
    image: template.image || ''
  }
  editingTemplate.value = template
  activeMode.value = 'create'
  uiStore.showInfo(`Editing "${template.name}" — update details and save`)
}

function cancelEdit() {
  resetState()
  activeMode.value = 'templates'
}

// Validation
function validateIdentifier() {
  const value = form.value.identifier
  if (!value) {
    identifierError.value = ''
    return
  }
  if (value.length > 64) {
    identifierError.value = 'Maximum 64 characters'
    return
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    identifierError.value = 'Only lowercase letters, numbers, and hyphens allowed'
    return
  }
  identifierError.value = ''
}

function onRecipientsChange(value) {
  recipientsText.value = value
}

// Actions
async function saveAsTemplate() {
  if (!canSaveTemplate.value) return

  isSaving.value = true
  const result = await badgesStore.createTemplate({ ...form.value })
  isSaving.value = false

  if (result.success) {
    uiStore.showSuccess(`Template "${form.value.name}" saved`)
  } else {
    uiStore.showError(result.error || 'Could not save template')
  }
}

async function updateTemplateChanges() {
  if (!editingTemplate.value || !canSaveTemplate.value) return

  isUpdating.value = true
  const result = await badgesStore.updateTemplate(editingTemplate.value.identifier, { ...form.value })
  isUpdating.value = false

  if (result.success) {
    uiStore.showSuccess(`Template "${form.value.name}" updated`)
    editingTemplate.value = null
    activeMode.value = 'templates'
  } else {
    uiStore.showError(result.error || 'Could not update template')
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  progressPercent.value = 10
  progressStatus.value = 'Preparing...'
  progressDetail.value = 'Getting ready to publish'

  await delay(400)
  progressPercent.value = 30
  progressStatus.value = 'Connecting to relays...'
  progressDetail.value = 'This may take a moment'

  await delay(500)
  progressPercent.value = 60
  progressStatus.value = 'Publishing badge...'
  progressDetail.value = 'Broadcasting to the network'

  const badgeData = activeMode.value === 'award' ? selectedTemplate.value : form.value
  const result = await badgesStore.createAndAwardBadge(badgeData, recipients.value)

  progressPercent.value = 100
  await delay(300)

  isSubmitting.value = false
  progressPercent.value = 0

  if (result.success) {
    const count = result.data.recipients_count
    uiStore.showSuccess(`"${badgeData.name}" awarded to ${count} recipient${count !== 1 ? 's' : ''}`)
    goBack()
  } else {
    uiStore.showError(result.error || 'Failed to create badge. Please try again.')
  }
}

async function deleteTemplate(template) {
  if (!confirm(`Delete "${template.name}"?\n\nThis template will be removed permanently.`)) return

  const result = await badgesStore.deleteTemplate(template.identifier)

  if (result.success) {
    uiStore.showSuccess('Template deleted')
  } else {
    uiStore.showError(result.error || 'Could not delete template')
  }
}

function refreshTemplates() {
  badgesStore.fetchAllTemplates()
}

function onImageError(e) {
  e.target.style.opacity = '0.2'
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

onMounted(() => {
  // Fetch both app templates (official) and user templates
  badgesStore.fetchAllTemplates()
})
</script>

<style scoped>
.creator {
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 4rem;
}

/* Header */
.page-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.page-header h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem;
}

.subtitle {
  color: var(--color-text-muted);
  margin: 0;
}

/* Section Title */
.section-title {
  font-size: 1.125rem;
  font-weight: 500;
  text-align: center;
  margin-bottom: 0.5rem;
  color: var(--color-text-muted);
}

.section-hint {
  font-size: 0.875rem;
  text-align: center;
  color: var(--color-text-subtle);
  margin-bottom: 1.5rem;
}

/* Mode Selection */
.mode-selection {
  padding: 0 1rem;
}

.mode-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 640px) {
  .page-header h1 {
    font-size: 1.5rem;
  }

  .mode-cards {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .mode-card {
    padding: 1.25rem;
  }

  .mode-icon {
    width: 44px;
    height: 44px;
  }

  .mode-content h3 {
    font-size: 0.9375rem;
  }

  .mode-content p {
    font-size: 0.75rem;
  }

  .workflow-header {
    padding: 1rem;
  }

  .workflow-title h2 {
    font-size: 1rem;
  }

  .workflow-body {
    padding: 1rem;
    gap: 1rem;
  }

  .step-indicator {
    width: 24px;
    height: 24px;
    font-size: 0.6875rem;
  }

  .step-info h3 {
    font-size: 0.875rem;
  }

  .badges-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .badge-card {
    padding: 0.75rem;
  }

  .badge-image {
    width: 40px;
    height: 40px;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions button {
    width: 100%;
  }
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.mode-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.mode-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  color: var(--color-text);
}

.mode-icon.official {
  background: var(--color-accent-soft);
}

.mode-icon.custom {
  background: var(--color-primary-soft);
}

.mode-content {
  flex: 1;
  min-width: 0;
}

.mode-content h3 {
  font-size: 1rem;
  margin: 0 0 0.25rem;
}

.mode-content p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem;
}

.mode-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.25rem 0.5rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.mode-arrow {
  color: var(--color-text-subtle);
  transition: transform 0.2s, color 0.2s;
  flex-shrink: 0;
}

.mode-card:hover .mode-arrow {
  transform: translateX(4px);
  color: var(--color-primary);
}

/* Templates Shortcut */
.templates-shortcut {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.25rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.templates-shortcut:hover {
  border-color: var(--color-primary);
}

.shortcut-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.shortcut-text {
  flex: 1;
  text-align: left;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.shortcut-arrow {
  color: var(--color-text-subtle);
  flex-shrink: 0;
}

/* Workflow */
.workflow {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.workflow-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text);
  transition: all 0.15s;
}

.back-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.workflow-title {
  flex: 1;
}

.workflow-title h2 {
  font-size: 1.125rem;
  margin: 0;
}

.workflow-title p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.125rem 0 0;
}

.refresh-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.refresh-btn:disabled {
  opacity: 0.5;
}

/* Workflow Body */
.workflow-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Steps */
.step {
  transition: opacity 0.2s;
}

.step-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.step-header {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  margin-bottom: 1rem;
}

.step-indicator {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border: 2px solid var(--color-border);
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.step-indicator.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.step-indicator.done {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.step-info h3 {
  font-size: 0.9375rem;
  margin: 0;
}

.step-info p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.125rem 0 0;
}

.step-info .step-done {
  color: var(--color-success);
}

/* Badges Grid */
.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.badge-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem;
  background: var(--color-surface-elevated);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.badge-card:hover {
  border-color: var(--color-primary-soft);
}

.badge-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.badge-image {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface);
}

.badge-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-details {
  flex: 1;
  min-width: 0;
}

.badge-details strong {
  display: block;
  font-size: 0.875rem;
}

.badge-details span {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-check {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Confirm Panel */
.step-final {
  padding: 1.25rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.confirm-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.confirm-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.preview-image {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.preview-info {
  flex: 1;
}

.preview-info strong {
  display: block;
  font-size: 1rem;
}

.preview-info span {
  display: block;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.confirm-meta {
  display: flex;
  gap: 1.5rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.meta-label {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: 0.875rem;
  font-weight: 500;
}

.meta-value.issuer {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.issuer-pic {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

/* Create Layout */
.create-layout {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 1.5rem;
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .create-layout {
    grid-template-columns: 1fr;
  }
  .create-sidebar {
    order: -1;
  }
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
}

.required {
  color: var(--color-danger);
}

.form-group input,
.form-group textarea {
  padding: 0.625rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--color-text);
  transition: border-color 0.15s;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

.form-group input.has-error {
  border-color: var(--color-danger);
}

.form-group input.readonly {
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  margin: 0;
}

.field-error {
  font-size: 0.6875rem;
  color: var(--color-danger);
  margin: 0;
}

.input-with-preview {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.input-with-preview input {
  flex: 1;
}

.input-preview {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface);
}

.input-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.form-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0.5rem 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

/* Sidebar */
.create-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.25rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.sidebar-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 0.75rem;
}

.sidebar-avatar.placeholder {
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.sidebar-label {
  font-size: 0.625rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-info strong {
  display: block;
  font-size: 0.9375rem;
}

.sidebar-info code {
  font-size: 0.6875rem;
  color: var(--color-primary);
}

.sidebar-tip {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--color-primary-soft);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
}

.tip-icon {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.sidebar-tip strong {
  display: block;
  margin-bottom: 0.25rem;
}

.sidebar-tip p {
  margin: 0;
  color: var(--color-text);
}

/* Templates Grid */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.25rem;
  padding: 1.5rem;
}

.template-item {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.template-item:hover {
  border-color: var(--color-primary);
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.template-image {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%);
  position: relative;
  overflow: hidden;
}

.template-image::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 60%, rgba(0, 0, 0, 0.05) 100%);
  pointer-events: none;
}

.template-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.template-item:hover .template-image img {
  transform: scale(1.05);
}

.template-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-muted);
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.template-item:hover .template-placeholder {
  opacity: 0.7;
}

.template-body {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.template-body h4 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.375rem;
  color: var(--color-text);
  transition: color 0.2s ease;
}

.template-item:hover .template-body h4 {
  color: var(--color-primary);
}

.template-body p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.625rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-body code {
  display: inline-block;
  font-size: 0.6875rem;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-family: ui-monospace, monospace;
}

.template-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: var(--color-surface);
}

/* Template Skeleton */
.template-skeleton {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.skel-image {
  height: 120px;
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-surface-hover) 50%, var(--color-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.skel-actions {
  padding: 0.875rem 1rem;
  display: flex;
  gap: 0.5rem;
}

.skel-btn {
  flex: 1;
  height: 28px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-surface-hover) 50%, var(--color-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-line {
  height: 14px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-surface-hover) 50%, var(--color-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-line.short {
  width: 75%;
  height: 12px;
}

.skel-line.shorter {
  width: 40%;
  height: 20px;
  margin-top: 0.25rem;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(180deg, transparent 0%, var(--color-surface-elevated) 100%);
  border-radius: var(--radius-lg);
  margin: 1.5rem;
}

.empty-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 1.25rem;
  color: var(--color-text-muted);
  opacity: 0.6;
}

.empty-icon :deep(svg) {
  width: 64px;
  height: 64px;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.625rem;
  color: var(--color-text);
}

.empty-state p {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0 0 1.75rem;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-submit {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.15s;
}

.btn-primary,
.btn-submit {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled),
.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.btn-primary:disabled,
.btn-secondary:disabled,
.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-submit {
  width: 100%;
  padding: 0.875rem;
  font-size: 1rem;
}

.btn-action {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  transform: translateY(0);
}

.btn-action:hover {
  transform: translateY(-1px);
}

.btn-action:active {
  transform: translateY(0);
}

.btn-action.primary {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 2px 4px rgba(var(--color-primary-rgb, 99, 102, 241), 0.2);
}

.btn-action.primary:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 4px 8px rgba(var(--color-primary-rgb, 99, 102, 241), 0.3);
}

.btn-action.secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-action.secondary:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-action.danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.btn-action.danger:hover {
  background: var(--color-danger);
  color: white;
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

/* Spinners */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.btn-spinner.dark {
  border-color: rgba(0,0,0,0.1);
  border-top-color: var(--color-text);
}

/* Progress Overlay */
.progress-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.progress-modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 2rem;
  text-align: center;
  max-width: 320px;
  width: 90%;
}

.progress-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1.25rem;
}

.progress-modal h3 {
  font-size: 1rem;
  margin: 0 0 0.25rem;
}

.progress-modal p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem;
}

.progress-bar {
  height: 4px;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Animation */
.animate-fadeIn {
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
