<template>
  <section class="protocol-section">
    <div class="protocol-header">
      <Icon name="bolt" size="lg" class="protocol-icon" />
      <h2>Built on Open Standards</h2>
      <p>Interoperable with any Nostr client that supports NIP-58</p>
    </div>

    <div class="protocol-cards">
      <!-- NIP-58 Core -->
      <div class="protocol-card">
        <div class="protocol-card-header">
          <span class="protocol-card-emoji">🏅</span>
          <h3>NIP-58 Core</h3>
          <button
            class="info-btn"
            :class="{ active: activeProtocolInfo === 'nip58' }"
            aria-label="Toggle NIP-58 info"
            @click="toggleProtocolInfo('nip58')"
          >
            <Icon name="info" size="xs" />
          </button>
        </div>
        <div v-if="activeProtocolInfo === 'nip58'" class="info-accordion">
          <p>NIP-58 defines how badges work on Nostr. Creators publish badge definitions, award them to users, and recipients can display them on their profile.</p>
          <a
            href="https://github.com/nostr-protocol/nips/blob/master/58.md"
            target="_blank"
            rel="noopener noreferrer"
            class="info-link"
          >
            Read the spec <Icon name="external-link" size="xs" />
          </a>
        </div>
        <div class="kind-chips">
          <button class="kind-chip" @click="showKindInfo('30009')">
            <code>30009</code>
            <span>Definition</span>
          </button>
          <button class="kind-chip" @click="showKindInfo('8')">
            <code>8</code>
            <span>Award</span>
          </button>
          <button class="kind-chip" @click="showKindInfo('10008')">
            <code>10008</code>
            <span>Profile</span>
          </button>
        </div>
      </div>

      <!-- Request Extension -->
      <div class="protocol-card protocol-card-extension">
        <div class="protocol-card-header">
          <span class="protocol-card-emoji">✨</span>
          <h3>Request Extension</h3>
          <button
            class="new-tag"
            type="button"
            title="View the proposal"
            @click="showProposalChooser = true"
          >NEW on NOSTR</button>
          <button
            class="info-btn"
            :class="{ active: activeProtocolInfo === 'request' }"
            aria-label="Toggle request extension info"
            @click="toggleProtocolInfo('request')"
          >
            <Icon name="info" size="xs" />
          </button>
        </div>
        <div v-if="activeProtocolInfo === 'request'" class="info-accordion">
          <p>A brand new Nostr-native protocol, not yet part of any NIP. Users can request badges from creators, submit proof of eligibility, track their requests, and get notified when approved.</p>
          <button class="info-link" type="button" @click="showProposalChooser = true">
            📝 View the proposal <Icon name="external-link" size="xs" />
          </button>
        </div>
        <div class="kind-chips">
          <button class="kind-chip" @click="showKindInfo('30058')">
            <code>30058</code>
            <span>Request</span>
          </button>
          <button class="kind-chip" @click="showKindInfo('30059')">
            <code>30059</code>
            <span>Response</span>
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- Kind Info Modal -->
  <Transition name="modal">
    <div
      v-if="activeKindInfo"
      class="kind-modal-overlay"
      @click="activeKindInfo = null"
      @keydown.escape="activeKindInfo = null"
    >
      <div class="kind-modal" @click.stop>
        <button class="modal-close" aria-label="Close modal" @click="activeKindInfo = null">
          <Icon name="x" size="sm" />
        </button>
        <code class="kind-code">kind: {{ activeKindInfo }}</code>
        <h4>{{ kindInfoData[activeKindInfo]?.title }}</h4>
        <p>{{ kindInfoData[activeKindInfo]?.description }}</p>
      </div>
    </div>
  </Transition>

  <!-- Proposal chooser: let the reader pick GitHub or NostrHub -->
  <Transition name="modal">
    <div
      v-if="showProposalChooser"
      class="chooser-overlay"
      @click="showProposalChooser = false"
      @keydown.escape="showProposalChooser = false"
    >
      <div class="chooser" @click.stop>
        <p class="chooser-title">Where would you like to read the proposal?</p>
        <a
          v-for="opt in proposalLinks"
          :key="opt.label"
          :href="opt.href"
          target="_blank"
          rel="noopener noreferrer"
          class="chooser-option"
          @click="showProposalChooser = false"
        >
          <span>{{ opt.label }}</span>
          <Icon name="external-link" size="xs" class="chooser-ext" />
        </a>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import Icon from '@/components/common/Icon.vue'

const activeProtocolInfo = ref(null) // 'nip58' | 'request' | null
const activeKindInfo = ref(null)     // '30009' | '8' | etc | null
const showProposalChooser = ref(false)

// The Request Extension proposal, viewable in two places.
const proposalLinks = [
  { label: 'View on GitHub', href: 'https://github.com/nostr-protocol/nips/pull/2204' },
  { label: 'View on NostrHub', href: 'https://nostrhub.io/naddr1qvzqqqrcvypzpas4q9emt4hs0x6r2sxcf29ft4gv7qdy3jwkqducfc7evqx42g40qqsxyctyvajj6mnfwq6nsttjv4ch2etnw3ej6ctwvskkgetwd9skcuc5nmdq5' }
]

const kindInfoData = {
  '30009': {
    title: 'Badge Definition',
    description: 'The blueprint for a badge. Contains the name, description, image, and criteria. Created by badge issuers.'
  },
  '8': {
    title: 'Badge Award',
    description: 'Issued when someone awards a badge to a recipient. Links the badge definition to the person receiving it.'
  },
  '10008': {
    title: 'Profile Badges',
    description: 'A user\'s curated collection of accepted badges. Controls which badges appear on their Nostr profile. This is the current NIP-58 kind ; it replaces the legacy kind 30008, which BadgeBox still reads so older collections keep showing.'
  },
  '30058': {
    title: 'Badge Request',
    description: 'Sent by users to request a badge from a creator. Can include proof of eligibility and a personal message.'
  },
  '30059': {
    title: 'Request Response',
    description: 'The creator\'s response to a request. Can approve (triggers badge award) or deny with a reason.'
  }
}

function toggleProtocolInfo(section) {
  activeProtocolInfo.value = activeProtocolInfo.value === section ? null : section
}

function showKindInfo(kind) {
  activeKindInfo.value = kind
}
</script>

<style scoped>
.protocol-section {
  padding: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.protocol-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.protocol-icon {
  color: var(--color-accent);
  margin-bottom: 0.5rem;
}

.protocol-header h2 {
  font-size: 1.375rem;
  margin: 0 0 0.5rem 0;
}

.protocol-header p {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 0.9375rem;
}

.protocol-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.protocol-card {
  padding: 1.25rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: border-color 0.2s ease;
}

.protocol-card:hover {
  border-color: var(--color-primary-soft);
}

.protocol-card-extension {
  background: linear-gradient(135deg, var(--color-surface-elevated) 0%, var(--color-primary-soft) 100%);
}

.protocol-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.protocol-card-emoji {
  font-size: 1.25rem;
}

.protocol-card-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  flex: 1;
}

.new-tag {
  padding: 0.125rem 0.5rem;
  background: var(--color-primary);
  color: white;
  font-size: 0.625rem;
  text-decoration: none;
  cursor: pointer;
  font-weight: 700;
  font-family: inherit;
  border: none;
  border-radius: var(--radius-full);
  letter-spacing: 0.05em;
  transition: opacity 0.15s;
}

.new-tag:hover {
  opacity: 0.85;
}

.info-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.info-btn:hover,
.info-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.info-accordion {
  padding: 1rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.info-accordion p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.info-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
}

.info-link:hover {
  text-decoration: underline;
}

button.info-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
}

.kind-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.kind-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.kind-chip:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.kind-chip:active {
  transform: scale(0.98);
}

.kind-chip code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.kind-chip span {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Kind Info Modal */
.kind-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.kind-modal {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  max-width: 340px;
  width: 100%;
  box-shadow: var(--shadow-xl);
}

.modal-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.kind-code {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
}

.kind-modal h4 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.kind-modal p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

/* Proposal chooser */
.chooser-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.chooser {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  max-width: 320px;
  width: 100%;
  box-shadow: var(--shadow-xl);
}

.chooser-title {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
}

.chooser-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  margin-top: 0.5rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;
}

.chooser-option:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.chooser-ext {
  flex-shrink: 0;
  color: var(--color-text-subtle);
}

.chooser-option:hover .chooser-ext {
  color: var(--color-primary);
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .kind-modal,
.modal-leave-active .kind-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from .kind-modal,
.modal-leave-to .kind-modal {
  transform: scale(0.95);
}

@media (max-width: 640px) {
  .protocol-section {
    padding: 1.5rem;
  }

  .protocol-header h2 {
    font-size: 1.25rem;
  }

  .protocol-cards {
    grid-template-columns: 1fr;
  }
}
</style>
