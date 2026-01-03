/**
 * useEventSigning Composable
 *
 * Provides a unified interface for signing Nostr events.
 * Automatically detects auth method (NIP-07 or nsec) and handles signing appropriately.
 */

import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  createBadgeDefinitionEvent,
  createBadgeAwardEvent,
  createProfileBadgesEvent,
  signEvent,
  npubToHex
} from '@/utils/nip07'

export function useEventSigning() {
  const authStore = useAuthStore()

  const isNip07 = computed(() => authStore.isNip07)
  const userHex = computed(() => authStore.hex)

  /**
   * Sign a badge definition event
   * @param {Object} badge - Badge data { identifier, name, description, image }
   * @returns {Promise<Object|null>} - Signed event for NIP-07, null for nsec
   */
  async function signBadgeDefinition(badge) {
    if (!isNip07.value) {
      return null // Backend will sign
    }

    const unsignedEvent = createBadgeDefinitionEvent(badge)
    return await signEvent(unsignedEvent)
  }

  /**
   * Sign a badge award event
   * @param {string} aTag - Badge definition a-tag (30009:pubkey:identifier)
   * @param {string[]} recipients - Array of recipient pubkeys (npub or hex)
   * @returns {Promise<Object|null>} - Signed event for NIP-07, null for nsec
   */
  async function signBadgeAward(aTag, recipients) {
    if (!isNip07.value) {
      return null // Backend will sign
    }

    // Convert all recipients to hex format
    const hexRecipients = recipients.map(r => {
      if (r.startsWith('npub1')) {
        return npubToHex(r)
      }
      return r
    })

    const unsignedEvent = createBadgeAwardEvent(aTag, hexRecipients)
    return await signEvent(unsignedEvent)
  }

  /**
   * Sign both badge definition and award events for create-and-award flow
   * @param {Object} badge - Badge data
   * @param {string[]} recipients - Recipient pubkeys
   * @returns {Promise<{definitionEvent: Object|null, awardEvent: Object|null}>}
   */
  async function signBadgeDefinitionAndAward(badge, recipients) {
    if (!isNip07.value) {
      return { definitionEvent: null, awardEvent: null }
    }

    // Sign definition first
    const definitionEvent = await signBadgeDefinition(badge)
    if (!definitionEvent) {
      throw new Error('Failed to sign badge definition')
    }

    // Build a_tag from the signed definition
    const aTag = `30009:${definitionEvent.pubkey}:${badge.identifier}`

    // Sign award
    const awardEvent = await signBadgeAward(aTag, recipients)
    if (!awardEvent) {
      throw new Error('Failed to sign badge award')
    }

    return { definitionEvent, awardEvent }
  }

  /**
   * Sign a profile badges event (kind 30008)
   * @param {Array} badgeTags - Array of badge tags [["a", aTag], ["e", eventId], ...]
   * @returns {Promise<Object|null>} - Signed event for NIP-07, null for nsec
   */
  async function signProfileBadges(badgeTags) {
    if (!isNip07.value) {
      return null // Backend will sign
    }

    const unsignedEvent = createProfileBadgesEvent(badgeTags)
    return await signEvent(unsignedEvent)
  }

  return {
    isNip07,
    userHex,
    signBadgeDefinition,
    signBadgeAward,
    signBadgeDefinitionAndAward,
    signProfileBadges
  }
}
