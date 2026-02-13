<template>
  <!-- LookupUser Modal -->
  <LookupUserModal
    v-if="ui.lookupUserModal.isOpen"
    :pubkey="ui.lookupUserModal.pubkey"
    :show-badges="ui.lookupUserModal.showBadges"
    @close="ui.closeLookupUser()"
    @badge-click="handleBadgeClick"
  />

  <!-- BadgeDetail Modal -->
  <BadgeDetailModal
    v-if="ui.badgeDetailModal.isOpen"
    :badge-a-tag="ui.badgeDetailModal.badgeATag"
    :initial-badge="ui.badgeDetailModal.badge"
    @close="ui.closeBadgeDetail()"
    @request="handleBadgeRequest"
  />

  <!-- RequestBadge Modal -->
  <RequestBadgeModal
    v-if="ui.requestBadgeModal.isOpen"
    :badge-a-tag="ui.requestBadgeModal.badgeATag"
    :badge="ui.requestBadgeModal.badge"
    @close="ui.closeRequestBadge()"
    @success="handleRequestSuccess"
  />

  <!-- DenyRequest Modal -->
  <DenyRequestModal
    v-if="ui.denyRequestModal.isOpen"
    :request="ui.denyRequestModal.request"
    @close="ui.closeDenyRequest()"
    @success="handleDenySuccess"
  />

  <!-- LoginPrompt Modal -->
  <LoginPromptModal
    v-if="ui.loginPromptModal.isOpen"
    :badge="ui.loginPromptModal.badge"
    @close="ui.closeLoginPrompt()"
  />
</template>

<script setup>
import { useUIStore } from '@/stores/ui'
import LookupUserModal from './LookupUserModal.vue'
import BadgeDetailModal from './BadgeDetailModal.vue'
import RequestBadgeModal from './RequestBadgeModal.vue'
import DenyRequestModal from './DenyRequestModal.vue'
import LoginPromptModal from './LoginPromptModal.vue'

const ui = useUIStore()

// Event handlers
function handleBadgeClick(badge) {
  // Badge click from LookupUser opens BadgeDetail
  ui.openBadgeDetail(badge.a_tag, badge)
}

function handleBadgeRequest(badge) {
  // Request badge action opens RequestBadge modal
  ui.openRequestBadge(badge.a_tag || ui.badgeDetailModal.badgeATag, badge)
}

function handleRequestSuccess(data) {
  // Request was successful - could emit event or refresh data
  console.log('Badge request created:', data)
}

function handleDenySuccess(data) {
  // Denial was successful - could emit event or refresh data
  console.log('Badge request denied:', data)
}
</script>
