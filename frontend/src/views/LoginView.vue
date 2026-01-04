<template>
  <div class="login">
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <Icon name="key" size="xl" />
        </div>
        <h1>Connect to Nostr</h1>
        <p>Sign in securely with your Nostr identity</p>
      </div>

      <!-- Extension Login (Primary) -->
      <div class="extension-section">
        <button
          v-if="extensionAvailable"
          @click="handleExtensionLogin"
          class="btn btn-extension btn-block"
          :disabled="isLoading"
        >
          <span v-if="isLoading && loginMethod === 'extension'" class="btn-spinner"></span>
          <Icon v-else name="extension" size="md" class="extension-icon" />
          <span v-if="isLoading && loginMethod === 'extension'">Connecting...</span>
          <span v-else>Connect with Extension</span>
        </button>

        <button
          v-else-if="extensionChecked"
          class="btn btn-extension-unavailable btn-block"
          disabled
        >
          <Icon name="extension" size="md" class="extension-icon" />
          <span>No Extension Detected</span>
        </button>

        <div v-else class="extension-checking">
          <span class="checking-spinner"></span>
          <span>Checking for extension...</span>
        </div>

        <p v-if="extensionAvailable" class="extension-hint">
          Recommended - Your key never leaves your extension
        </p>

        <div v-if="!extensionAvailable && extensionChecked" class="extension-missing">
          <p class="missing-text">Get a Nostr extension to sign in securely:</p>
          <div class="extension-links">
            <a href="https://github.com/nickg68/nos2x-fox" target="_blank" class="ext-link">
              nos2x-fox
            </a>
            <a href="https://getalby.com" target="_blank" class="ext-link">
              Alby
            </a>
            <a href="https://github.com/nickg68/nos2x" target="_blank" class="ext-link">
              nos2x
            </a>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="divider">
        <span>or</span>
      </div>

      <!-- nsec Login (Fallback) -->
      <div class="nsec-section">
        <button
          v-if="!showNsecForm"
          @click="showNsecForm = true"
          class="btn btn-text btn-block"
        >
          Use private key (nsec)
        </button>

        <form v-else @submit.prevent="handleNsecLogin" class="nsec-form">
          <div class="form-group">
            <label for="nsec">Private Key</label>
            <div class="input-wrapper">
              <input
                id="nsec"
                v-model="nsec"
                :type="showKey ? 'text' : 'password'"
                placeholder="nsec1..."
                class="input"
                :class="{ 'input-error': error }"
                autocomplete="off"
                spellcheck="false"
              />
              <button
                type="button"
                @click="showKey = !showKey"
                class="toggle-visibility"
                :title="showKey ? 'Hide key' : 'Show key'"
              >
                <Icon :name="showKey ? 'eye-off' : 'eye'" size="sm" />
              </button>
            </div>
            <p v-if="error" class="error-message">{{ error }}</p>
          </div>

          <div class="nsec-actions">
            <button
              type="button"
              @click="showNsecForm = false; nsec = ''; error = ''"
              class="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="!nsec || isLoading"
            >
              <span v-if="isLoading && loginMethod === 'nsec'" class="btn-spinner"></span>
              <span v-if="isLoading && loginMethod === 'nsec'">Signing in...</span>
              <span v-else>Continue</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Error display for extension -->
      <p v-if="error && loginMethod === 'extension'" class="error-message extension-error">
        {{ error }}
      </p>

      <!-- Security notes -->
      <div class="login-footer">
        <div class="security-note">
          <Icon name="shield" size="md" class="note-icon" />
          <div class="note-content">
            <strong>Your keys stay private</strong>
            <p>
              Extension login is most secure - your private key never leaves the extension.
              Manual entry uses session storage only.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import Icon from '@/components/common/Icon.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

// Extension state
const extensionAvailable = ref(false)
const extensionChecked = ref(false)

// nsec form state
const showNsecForm = ref(false)
const nsec = ref('')
const showKey = ref(false)

// Shared state
const isLoading = ref(false)
const error = ref('')
const loginMethod = ref(null) // 'extension' | 'nsec'

// Check for extension on mount
onMounted(async () => {
  extensionAvailable.value = await authStore.checkNip07Available()
  extensionChecked.value = true
})

// Handle extension login
async function handleExtensionLogin() {
  error.value = ''
  isLoading.value = true
  loginMethod.value = 'extension'

  const result = await authStore.loginWithExtension()

  isLoading.value = false

  if (result.success) {
    uiStore.showSuccess(`Connected via extension! Welcome, ${authStore.displayName} 👋`)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } else {
    if (result.error.includes('denied') || result.error.includes('rejected')) {
      error.value = 'Permission denied. Please approve the request in your extension.'
    } else if (result.error.includes('detected')) {
      error.value = result.error
      extensionAvailable.value = false
    } else {
      error.value = result.error || 'Failed to connect with extension.'
    }
  }
}

// Handle nsec login
async function handleNsecLogin() {
  if (!nsec.value) return

  error.value = ''
  isLoading.value = true
  loginMethod.value = 'nsec'

  const result = await authStore.login(nsec.value)

  isLoading.value = false

  if (result.success) {
    uiStore.showSuccess(`Welcome back, ${authStore.displayName}! 👋`)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } else {
    if (result.error.includes('invalid') || result.error.includes('Invalid')) {
      error.value = "That doesn't look like a valid key. Make sure it starts with 'nsec1'."
    } else if (result.error.includes('network') || result.error.includes('Network')) {
      error.value = "Couldn't connect. Please check your internet and try again."
    } else {
      error.value = result.error || 'Something went wrong. Please try again.'
    }
  }
}
</script>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  padding: 2rem 1rem;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 2.5rem;
  box-shadow: var(--shadow-lg);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  color: var(--color-primary);
}

.login-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.login-header p {
  color: var(--color-text-muted);
  margin: 0;
}

/* Extension Section */
.extension-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-extension {
  background: linear-gradient(135deg, var(--color-primary) 0%, #7c3aed 100%);
  color: white;
  font-size: 1.0625rem;
  padding: 1rem 1.5rem;
}

.btn-extension:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-extension-unavailable {
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  padding: 1rem 1.5rem;
}

.extension-icon {
  flex-shrink: 0;
}

.extension-hint {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  text-align: center;
  margin: 0;
}

.extension-checking {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.checking-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.extension-missing {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  padding: 1rem;
  text-align: center;
}

.missing-text {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem 0;
}

.extension-links {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.ext-link {
  font-size: 0.8125rem;
  color: var(--color-primary);
  text-decoration: none;
  padding: 0.375rem 0.75rem;
  background: var(--color-primary-soft);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.ext-link:hover {
  background: var(--color-primary);
  color: white;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

/* nsec Section */
.nsec-section {
  display: flex;
  flex-direction: column;
}

.btn-text {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  font-size: 0.9375rem;
}

.btn-text:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.nsec-form {
  display: flex;
  flex-direction: column;
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
  font-size: 0.875rem;
}

.input-wrapper {
  position: relative;
}

.input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 0.875rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.input-error {
  border-color: var(--color-danger);
}

.input-error:focus {
  box-shadow: 0 0 0 3px var(--color-danger-soft);
}

.toggle-visibility {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.125rem;
  padding: 0.25rem;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.toggle-visibility:hover {
  opacity: 1;
}

.nsec-actions {
  display: flex;
  gap: 0.75rem;
}

.nsec-actions .btn {
  flex: 1;
}

.error-message {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  background: var(--color-danger-soft);
  border-radius: var(--radius-sm);
}

.extension-error {
  margin-top: 1rem;
}

/* Buttons */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-block {
  width: 100%;
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

.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface);
  border-color: var(--color-text-muted);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Footer */
.login-footer {
  margin-top: 1.5rem;
}

.security-note {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-success-soft);
  border: 1px solid var(--color-success);
  border-radius: var(--radius-md);
}

.note-icon {
  flex-shrink: 0;
  color: var(--color-success);
}

.note-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.note-content strong {
  font-size: 0.8125rem;
  color: var(--color-text);
}

.note-content p {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}
</style>
