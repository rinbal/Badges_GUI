<template>
  <div class="login">
    <div class="login-card">
      <div class="login-header">
        <span class="login-icon">🔐</span>
        <h1>Login</h1>
        <p>Enter your Nostr private key to continue</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="nsec">Private Key (nsec)</label>
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
            >
              {{ showKey ? '🙈' : '👁️' }}
            </button>
          </div>
          <p v-if="error" class="error-message">{{ error }}</p>
        </div>
        
        <button 
          type="submit" 
          class="btn btn-primary btn-block"
          :disabled="!nsec || isLoading"
        >
          <LoadingSpinner v-if="isLoading" size="sm" />
          <span v-else>Login</span>
        </button>
      </form>
      
      <div class="login-footer">
        <div class="security-note">
          <span class="note-icon">🔒</span>
          <p>
            Your private key is stored only in your browser session 
            and is never sent to any server except for signing events.
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
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

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
    uiStore.showSuccess('Logged in successfully!')
    
    // Redirect to original destination or home
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } else {
    error.value = result.error
  }
}
</script>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
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
  font-size: 0.875rem;
  margin: 0;
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

.login-footer {
  margin-top: 2rem;
}

.security-note {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.note-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.security-note p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}
</style>

