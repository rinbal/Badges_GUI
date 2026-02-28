<template>
  <Teleport to="body">
    <Transition name="pwa-slide">
      <div v-if="isAuthenticated && showBanner" class="pwa-bar">
        <div class="pwa-bar-inner">
          <img src="/BadgeBox_ohne_bg.png" alt="" class="pwa-icon" />

          <div class="pwa-text">
            <span class="pwa-label">Install BadgeBox</span>
            <span class="pwa-desc">Use it like a native app</span>
          </div>

          <!-- Native prompt: single install button -->
          <button
            v-if="installInstructions.hasNativePrompt && deferredPrompt"
            class="pwa-btn pwa-btn--primary"
            @click="handleInstall"
          >
            Install
          </button>

          <!-- Manual: show guide toggle -->
          <button
            v-else
            class="pwa-btn pwa-btn--primary"
            @click="showGuide = !showGuide"
          >
            {{ showGuide ? 'Close' : 'Show me how' }}
          </button>

          <button class="pwa-close" @click="dismiss" aria-label="Dismiss">
            <Icon name="x" size="xs" />
          </button>
        </div>

        <!-- Expandable visual guide -->
        <Transition name="pwa-expand">
          <div v-if="showGuide" class="pwa-guide">
            <div class="pwa-guide-inner">

              <!-- Step-by-step with visual mockups -->
              <div class="pwa-guide-steps">
                <div
                  v-for="(step, i) in guideSteps"
                  :key="i"
                  class="pwa-guide-step"
                  :class="{ 'pwa-guide-step--active': activeStep === i }"
                  @click="activeStep = i"
                >
                  <span class="pwa-guide-step-num">{{ i + 1 }}</span>
                  <span class="pwa-guide-step-text">{{ step.text }}</span>
                </div>
              </div>

              <!-- Browser mockup for active step -->
              <div class="pwa-mockup-area">
                <!-- Chrome / Edge / Brave address bar -->
                <template v-if="browserInfo.name === 'chrome' || browserInfo.name === 'edge' || browserInfo.name === 'brave' || browserInfo.name === 'opera'">
                  <ChromeBarMockup :step="activeStep" :browser="browserInfo.name" />
                </template>

                <!-- Safari iOS -->
                <template v-else-if="browserInfo.name === 'safari-ios'">
                  <SafariIosMockup :step="activeStep" />
                </template>

                <!-- Safari macOS -->
                <template v-else-if="browserInfo.name === 'safari-macos'">
                  <SafariMacMockup :step="activeStep" />
                </template>

                <!-- Firefox -->
                <template v-else-if="browserInfo.name === 'firefox'">
                  <FirefoxMockup :step="activeStep" />
                </template>

                <!-- Samsung / Unknown - generic -->
                <template v-else>
                  <GenericMockup :step="activeStep" :browser="browserInfo.name" />
                </template>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePwaInstall } from '@/composables/usePwaInstall'
import Icon from '@/components/common/Icon.vue'
import ChromeBarMockup from '@/components/pwa/ChromeBarMockup.vue'
import SafariIosMockup from '@/components/pwa/SafariIosMockup.vue'
import SafariMacMockup from '@/components/pwa/SafariMacMockup.vue'
import FirefoxMockup from '@/components/pwa/FirefoxMockup.vue'
import GenericMockup from '@/components/pwa/GenericMockup.vue'

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

const {
  showBanner,
  browserInfo,
  installInstructions,
  deferredPrompt,
  promptInstall,
  dismiss
} = usePwaInstall()

const showGuide = ref(false)
const activeStep = ref(0)

const guideSteps = computed(() => {
  const steps = {
    'chrome': [
      { text: 'Click the \u22EE menu (three dots) in the top right' },
      { text: 'Hover "Stream, save & share"' },
      { text: 'Click "Install page as app..."' }
    ],
    'edge': [
      { text: 'Click the \u22EF menu (three dots) in the top right' },
      { text: 'Hover "Apps"' },
      { text: 'Click "Install this site as an app"' }
    ],
    'brave': [
      { text: 'Click the \u2630 menu in the top right' },
      { text: 'Click "Install BadgeBox..."' }
    ],
    'opera': [
      { text: 'Click the Easy Setup menu in the top right' },
      { text: 'Scroll down and click "Install page as app"' }
    ],
    'safari-ios': [
      { text: 'Tap the Share button at the bottom' },
      { text: 'Tap "Add to Home Screen"' },
      { text: 'Tap "Add" to confirm' }
    ],
    'safari-macos': [
      { text: 'Click "File" in the menu bar' },
      { text: 'Click "Add to Dock..."' },
      { text: 'Click "Add" to confirm' }
    ],
    'firefox': [
      { text: 'Click the page actions menu (\u22EF) in the address bar' },
      { text: 'Select "Install this site as an app"' },
      { text: 'Click "Install" to confirm' }
    ],
    'samsung': [
      { text: 'Tap the menu button' },
      { text: 'Tap "Add page to" then "Home screen"' }
    ],
    'arc': [
      { text: 'Click the site controls in the URL bar' },
      { text: 'Select "More Tools" > "Create Shortcut"' },
      { text: 'Check "Open as window" and click "Create"' }
    ],
    'unknown': [
      { text: 'Open your browser menu' },
      { text: 'Look for "Install" or "Add to Home Screen"' }
    ]
  }
  return steps[browserInfo.value.name] || steps['unknown']
})

async function handleInstall() {
  await promptInstall()
}
</script>

<style scoped>
/* ── Bottom bar (always visible) ── */
.pwa-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--color-surface-elevated);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
  /* iOS safe area for home indicator */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.pwa-bar-inner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 1.25rem;
}

.pwa-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.pwa-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.pwa-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}

.pwa-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.2;
}

.pwa-btn {
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  padding: 0.45rem 1rem;
  transition: background var(--transition-fast);
}

.pwa-btn--primary {
  background: var(--color-primary);
  color: #fff;
}

.pwa-btn--primary:hover {
  background: var(--color-primary-hover);
}

.pwa-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--color-text-subtle);
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.pwa-close:hover {
  color: var(--color-text-muted);
  background: var(--color-surface-hover);
}

/* ── Expandable guide panel ── */
.pwa-guide {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  overflow-y: auto;
  max-height: 60vh;
  -webkit-overflow-scrolling: touch;
}

.pwa-guide-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

/* ── Step list (left side on desktop, top on mobile) ── */
.pwa-guide-steps {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex-shrink: 0;
  width: 280px;
}

.pwa-guide-step {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.pwa-guide-step:hover {
  background: var(--color-surface-hover);
}

.pwa-guide-step--active {
  background: var(--color-primary-soft);
}

.pwa-guide-step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all var(--transition-fast);
}

.pwa-guide-step--active .pwa-guide-step-num {
  background: var(--color-primary);
  color: #fff;
}

.pwa-guide-step-text {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.35;
  transition: color var(--transition-fast);
}

.pwa-guide-step--active .pwa-guide-step-text {
  color: var(--color-text);
}

/* ── Mockup area (right side on desktop, below on mobile) ── */
.pwa-mockup-area {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

/* ── Transitions ── */
.pwa-slide-enter-active {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}

.pwa-slide-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}

.pwa-slide-enter-from,
.pwa-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.pwa-expand-enter-active {
  transition: all 0.3s ease-out;
}

.pwa-expand-leave-active {
  transition: all 0.2s ease-in;
}

.pwa-expand-enter-from,
.pwa-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* ── Tablet ── */
@media (max-width: 768px) {
  .pwa-guide-inner {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem 1rem;
  }

  .pwa-guide-steps {
    width: 100%;
  }

  .pwa-mockup-area {
    width: 100%;
    justify-content: center;
  }
}

/* ── Phone ── */
@media (max-width: 480px) {
  .pwa-bar-inner {
    padding: 0.6rem 0.75rem;
    gap: 0.5rem;
  }

  .pwa-icon {
    width: 30px;
    height: 30px;
  }

  .pwa-label {
    font-size: 0.8rem;
  }

  .pwa-desc {
    font-size: 0.7rem;
  }

  .pwa-btn {
    font-size: 0.75rem;
    padding: 0.4rem 0.75rem;
  }

  .pwa-guide {
    max-height: 55vh;
  }

  .pwa-guide-inner {
    padding: 0.6rem 0.75rem 0.75rem;
    gap: 0.6rem;
  }

  .pwa-guide-step {
    padding: 0.4rem 0.5rem;
  }

  .pwa-guide-step-text {
    font-size: 0.75rem;
  }

  .pwa-guide-step-num {
    width: 18px;
    height: 18px;
    font-size: 0.65rem;
  }
}
</style>
