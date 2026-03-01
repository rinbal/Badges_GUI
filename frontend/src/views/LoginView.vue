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

      <!-- ── Main login options ────────────────────────────────────────── -->
      <template v-if="!amberConnecting">

        <!-- NIP-07 Extension (primary) -->
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

          <p v-if="extensionAvailable" class="method-hint">
            Recommended — your key never leaves your extension
          </p>

          <div v-if="!extensionAvailable && extensionChecked" class="extension-missing">
            <p class="missing-text">Get a Nostr extension to sign in securely:</p>
            <div class="extension-links">
              <a href="https://github.com/nickg68/nos2x-fox" target="_blank" class="ext-link">nos2x-fox</a>
              <a href="https://getalby.com" target="_blank" class="ext-link">Alby</a>
              <a href="https://github.com/nickg68/nos2x" target="_blank" class="ext-link">nos2x</a>
            </div>
          </div>
        </div>

        <!-- Amber (Android) -->
        <div class="amber-section">
          <button
            @click="startAmberConnect"
            class="btn btn-amber btn-block"
            :disabled="isLoading"
          >
            <span class="amber-dot"></span>
            Sign in with Amber
          </button>
          <p class="method-hint">For Android users — signs on your phone via the Amber app</p>
        </div>

        <!-- Divider -->
        <div class="divider"><span>or</span></div>

        <!-- nsec (fallback) -->
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

        <!-- Extension error -->
        <p v-if="error && loginMethod === 'extension'" class="error-message extension-error">
          {{ error }}
        </p>

      </template>

      <!-- ── Amber QR connect panel ─────────────────────────────────────── -->
      <div v-else class="amber-connect">
        <div class="amber-connect-header">
          <div class="amber-logo-circle">
            <span class="amber-dot-lg"></span>
          </div>
          <h2>Scan with Amber</h2>
          <p>Open Amber on your Android phone and scan this code</p>
        </div>

        <!-- QR Code -->
        <div class="qr-wrapper">
          <img
            v-if="qrDataUrl"
            :src="qrDataUrl"
            alt="Amber connection QR code"
            class="qr-image"
          />
          <div v-else class="qr-placeholder">
            <span class="checking-spinner"></span>
          </div>
        </div>

        <!-- Steps -->
        <ol class="amber-steps">
          <li>Open the <strong>Amber</strong> app on your Android phone</li>
          <li>Tap the <strong>scan icon</strong> in the top right</li>
          <li>Scan this code — then tap <strong>Connect</strong></li>
        </ol>

        <!-- Deep link for mobile users -->
        <a
          v-if="connectUri && isMobile"
          :href="connectUri"
          class="btn btn-amber btn-block"
        >
          <span class="amber-dot"></span>
          Open Amber
        </a>

        <!-- Status -->
        <div class="amber-status">
          <span v-if="amberError" class="status-error">
            <Icon name="alert-circle" size="sm" />
            {{ amberError }}
          </span>
          <span v-else-if="amberStatus === 'finalizing'" class="status-finalizing">
            <span class="checking-spinner"></span>
            Amber connected — setting up your account…
          </span>
          <span v-else class="status-waiting">
            <span class="checking-spinner"></span>
            Waiting for Amber to connect…
          </span>
        </div>

        <!-- Timeout countdown -->
        <p v-if="amberSecondsLeft <= 30 && amberSecondsLeft > 0" class="timeout-warning">
          Code expires in {{ amberSecondsLeft }}s
        </p>

        <div class="amber-actions">
          <button
            v-if="amberError || amberSecondsLeft === 0"
            @click="startAmberConnect"
            class="btn btn-amber"
          >
            Try Again
          </button>
          <button @click="cancelAmberConnect" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>

      <!-- ── Footer (always visible) ───────────────────────────────────── -->
      <div class="login-footer">
        <div class="security-note">
          <Icon name="shield" size="md" class="note-icon" />
          <div class="note-content">
            <strong>Your keys stay private</strong>
            <p>
              Extension and Amber login never expose your private key to this website.
              Manual entry uses session storage only.
            </p>
          </div>
        </div>

        <details class="nostr-explainer">
          <summary>
            <span class="explainer-icon">?</span>
            <span>What is Nostr?</span>
            <Icon name="chevron-right" size="sm" class="expand-icon" />
          </summary>
          <div class="explainer-content">
            <p>
              <strong>Nostr</strong> is a decentralized social protocol. Instead of accounts on a company's server,
              you use cryptographic keys that you control.
            </p>
            <div class="key-types">
              <div class="key-type">
                <code>npub</code>
                <span>Your public key — share this with others (like a username)</span>
              </div>
              <div class="key-type">
                <code>nsec</code>
                <span>Your private key — keep this secret! (like a password)</span>
              </div>
            </div>
            <div class="extension-benefit">
              <Icon name="extension" size="sm" class="benefit-icon" />
              <div>
                <strong>Why use an extension or Amber?</strong>
                <p>
                  They store your private key securely and sign events without
                  exposing your key to websites. It's the safest way to use Nostr.
                </p>
              </div>
            </div>
            <a href="https://nostr.how" target="_blank" class="learn-more">
              Learn more about Nostr
              <Icon name="external-link" size="xs" />
            </a>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import Icon from '@/components/common/Icon.vue'
import QRCode from 'qrcode'
import { BunkerSigner } from 'nostr-tools/nip46'
import { SimplePool as NostrPool } from 'nostr-tools'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

// ── Extension state ───────────────────────────────────────────────────────────
const extensionAvailable = ref(false)
const extensionChecked = ref(false)

// ── nsec form state ───────────────────────────────────────────────────────────
const showNsecForm = ref(false)
const nsec = ref('')
const showKey = ref(false)

// ── Shared state ──────────────────────────────────────────────────────────────
const isLoading = ref(false)
const error = ref('')
const loginMethod = ref(null) // 'extension' | 'nsec' | 'amber'

// ── Amber connect state ───────────────────────────────────────────────────────
const amberConnecting = ref(false)
const connectUri = ref('')
const qrDataUrl = ref('')
const amberError = ref('')
const amberSecondsLeft = ref(90)
const amberStatus = ref('waiting') // 'waiting' | 'finalizing'

let _amberAbortController = null
let _amberTimerInterval = null

// Detect mobile for the "Open Amber" deep link
const isMobile = computed(() =>
  /android/i.test(navigator.userAgent)
)

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  extensionAvailable.value = await authStore.checkNip07Available()
  extensionChecked.value = true
})

onBeforeUnmount(() => {
  cleanupAmber()
})

// ── NIP-07 extension login ────────────────────────────────────────────────────

async function handleExtensionLogin() {
  error.value = ''
  isLoading.value = true
  loginMethod.value = 'extension'

  const result = await authStore.loginWithExtension()

  isLoading.value = false

  if (result.success) {
    await afterLogin()
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

// ── nsec login ────────────────────────────────────────────────────────────────

async function handleNsecLogin() {
  if (!nsec.value) return

  error.value = ''
  isLoading.value = true
  loginMethod.value = 'nsec'

  const result = await authStore.login(nsec.value)

  isLoading.value = false

  if (result.success) {
    await afterLogin()
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

// ── Amber / NIP-46 login ──────────────────────────────────────────────────────

async function startAmberConnect() {
  cleanupAmber()
  amberError.value = ''
  amberSecondsLeft.value = 90
  amberStatus.value = 'waiting'
  loginMethod.value = 'amber'

  // Generate connection URI
  const { localSk, connectUri: uri } = authStore.prepareAmberConnect()
  connectUri.value = uri
  amberConnecting.value = true

  // Generate QR code
  try {
    qrDataUrl.value = await QRCode.toDataURL(uri, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    })
  } catch {
    // QR generation is cosmetic only — deep link still works
  }

  // Start countdown timer
  _amberTimerInterval = setInterval(() => {
    amberSecondsLeft.value--
    if (amberSecondsLeft.value <= 0) {
      clearInterval(_amberTimerInterval)
    }
  }, 1000)

  // Wait for Amber to connect (90 second timeout, cancellable)
  _amberAbortController = new AbortController()
  const pool = new NostrPool()

  try {
    const signer = await BunkerSigner.fromURI(
      localSk,
      uri,
      { pool },
      _amberAbortController.signal
    )

    // Amber approved — show immediate feedback while we finalize
    amberStatus.value = 'finalizing'
    await authStore.finalizeAmberLogin(signer, localSk)
    cleanupAmber()
    await afterLogin()
  } catch (err) {
    if (err?.name === 'AbortError') {
      // User cancelled — no error shown
      return
    }
    amberError.value = 'Could not connect to Amber. Make sure the app is open and try again.'
  }
}

function cancelAmberConnect() {
  cleanupAmber()
  amberConnecting.value = false
  connectUri.value = ''
  qrDataUrl.value = ''
  amberError.value = ''
}

function cleanupAmber() {
  if (_amberAbortController) {
    _amberAbortController.abort()
    _amberAbortController = null
  }
  if (_amberTimerInterval) {
    clearInterval(_amberTimerInterval)
    _amberTimerInterval = null
  }
}

// ── Post-login navigation ─────────────────────────────────────────────────────

async function afterLogin() {
  uiStore.showSuccess(`Welcome, ${authStore.displayName} 👋`)
  const { badgeATag, badge } = uiStore.pendingBadgeRequest
  if (badgeATag) {
    uiStore.clearPendingBadgeRequest()
    router.push(route.query.redirect || '/')
    uiStore.openRequestBadge(badgeATag, badge)
  } else {
    router.push(route.query.redirect || '/')
  }
  uiStore.openRelayInfo()
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

/* ===========================================
   Header
   =========================================== */
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

/* ===========================================
   Extension Section
   =========================================== */
.extension-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
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

.method-hint {
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

/* ===========================================
   Amber Section
   =========================================== */
.amber-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.btn-amber {
  background: #f97316;
  color: white;
  font-size: 1rem;
  padding: 0.875rem 1.5rem;
  border: none;
}

.btn-amber:hover:not(:disabled) {
  background: #ea6c0a;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

.amber-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
}

/* ===========================================
   Divider
   =========================================== */
.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.25rem 0;
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

/* ===========================================
   nsec Section
   =========================================== */
.nsec-section {
  display: flex;
  flex-direction: column;
}

.btn-text {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-text-muted);
  font-size: 0.9375rem;
}

.btn-text:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
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

/* ===========================================
   Amber Connect Panel
   =========================================== */
.amber-connect {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.amber-connect-header {
  text-align: center;
}

.amber-logo-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f97316;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.75rem;
}

.amber-dot-lg {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
}

.amber-connect-header h2 {
  font-size: 1.375rem;
  margin: 0 0 0.375rem;
}

.amber-connect-header p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0;
}

.qr-wrapper {
  padding: 0.75rem;
  background: white;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-image {
  display: block;
  width: 200px;
  height: 200px;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.amber-steps {
  list-style: decimal;
  padding-left: 1.25rem;
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.75;
  align-self: stretch;
}

.amber-steps li {
  padding-left: 0.25rem;
}

.amber-status {
  font-size: 0.8125rem;
}

.status-waiting {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
}

.status-finalizing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-success);
  font-weight: 500;
}

.status-error {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--color-danger);
}

.timeout-warning {
  font-size: 0.8125rem;
  color: var(--color-warning);
  margin: 0;
}

.amber-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.amber-actions .btn {
  flex: 1;
}

/* ===========================================
   Buttons (shared)
   =========================================== */
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
  background: var(--color-surface-hover);
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

.checking-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===========================================
   Footer
   =========================================== */
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

/* ===========================================
   Nostr Explainer
   =========================================== */
.nostr-explainer {
  margin-top: 1rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.nostr-explainer summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  list-style: none;
  transition: color 0.15s;
}

.nostr-explainer summary::-webkit-details-marker {
  display: none;
}

.nostr-explainer summary:hover {
  color: var(--color-text);
}

.explainer-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
}

.expand-icon {
  margin-left: auto;
  color: var(--color-text-subtle);
  transition: transform 0.2s;
}

.nostr-explainer[open] .expand-icon {
  transform: rotate(90deg);
}

.explainer-content {
  padding: 0 1rem 1rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  border-top: 1px solid var(--color-border);
  margin-top: 0;
}

.explainer-content > p {
  margin: 1rem 0;
}

.key-types {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
}

.key-type {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
}

.key-type code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.key-type span {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.extension-benefit {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--color-primary-soft);
  border-radius: var(--radius-md);
  margin: 1rem 0;
}

.benefit-icon {
  flex-shrink: 0;
  color: var(--color-primary);
  margin-top: 0.125rem;
}

.extension-benefit strong {
  display: block;
  font-size: 0.8125rem;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

.extension-benefit p {
  font-size: 0.75rem;
  margin: 0;
  color: var(--color-text);
}

.learn-more {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--color-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s;
}

.learn-more:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

/* ===========================================
   Mobile Responsive
   =========================================== */
@media (max-width: 480px) {
  .login {
    padding: 1rem 0.5rem;
  }

  .login-card {
    padding: 1.5rem;
  }
}
</style>
