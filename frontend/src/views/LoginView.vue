<template>
  <div class="login">
    <div class="login-card">
      <div class="login-header">
        <span class="login-icon">🔐</span>
        <h1>Welcome Back</h1>
        <p>Enter your Nostr private key to get started</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="nsec">Your Private Key</label>
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
              {{ showKey ? '🙈' : '👁️' }}
            </button>
          </div>
          <p v-if="error" class="error-message">{{ error }}</p>
          <p v-else class="input-hint">This is the key that starts with "nsec1"</p>
        </div>
        
        <button 
          type="submit" 
          class="btn btn-primary btn-block"
          :disabled="!nsec || isLoading"
        >
          <span v-if="isLoading" class="btn-spinner"></span>
          <span v-if="isLoading">Signing in...</span>
          <span v-else>Continue</span>
        </button>
      </form>
      
      <div class="login-footer">
        <div class="security-note">
          <span class="note-icon">🔒</span>
          <div class="note-content">
            <strong>Your key stays private</strong>
            <p>
              We only keep your key in your browser session. It's never saved 
              to any server and disappears when you close the tab.
            </p>
          </div>
        </div>
        
        <div class="help-note">
          <span class="help-icon">❓</span>
          <p>
            Don't have a Nostr key? You can create one with apps like 
            <a href="https://nostrid.mybuho.de" target="_blank">NostrID</a>, 
            <a href="https://nostrudel.ninja" target="_blank">noStrudel</a>,
            <a href="https://www.amethyst.social/" target="_blank">Amethyst</a> or
            <a href="https://zap-tracker.vercel.app" target="_blank">ZapTracker</a>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

const nsec = ref('')
const showKey = ref(false)
const isLoading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!nsec.value) return
  
  error.value = ''
  isLoading.value = true
  
  const result = await authStore.login(nsec.value)
  
  isLoading.value = false
  
  if (result.success) {
    uiStore.showSuccess(`Welcome back, ${authStore.displayName}! 👋`)
    
    // Redirect to original destination or home
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } else {
    // Friendly error messages
    if (result.error.includes('invalid') || result.error.includes('Invalid')) {
      error.value = "That doesn't look like a valid key. Make sure it starts with 'nsec1'."
    } else if (result.error.includes('network') || result.error.includes('Network')) {
      error.value = "Couldn't connect. Please check your internet and try again."
    } else {
      error.value = result.error || "Something went wrong. Please try again."
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
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
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

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.input-wrapper {
  position: relative;
}

.input {
  width: 100%;
  padding: 0.875rem 3rem 0.875rem 1rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.9375rem;
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

.input-hint {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin: 0;
}

.toggle-visibility {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0.25rem;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.toggle-visibility:hover {
  opacity: 1;
}

.error-message {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  background: var(--color-danger-soft);
  border-radius: var(--radius-sm);
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 1rem;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-footer {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  font-size: 1.25rem;
  flex-shrink: 0;
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

.help-note {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.help-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.help-note p {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

.help-note a {
  color: var(--color-primary);
}

.help-note a:hover {
  text-decoration: underline;
}
</style>
