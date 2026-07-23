/**
 * NIP-29 Group Chat Service (nostr-core only)
 *
 * Transport for a single relay-managed group. NIP-29 pins all of a group's
 * traffic to one host relay, so this owns a single dedicated Relay connection to
 * it - deliberately separate from the shared outbox pool, because the group
 * relay speaks NIP-42 (it challenges for auth) and the pool has no auth support.
 *
 * The dedicated Relay wires `onauth`: when the relay challenges, we sign a
 * kind-22242 auth event with the active signer and send it back. Metadata reads
 * work before/without auth (anonymous read), so logged-out visitors still see
 * the group; sending and the members-only feed come after auth.
 *
 * Kinds (NIP-29):
 *   9     chat message         39000 group metadata
 *   9005  delete event (admin) 39001 group admins
 *   9021  join request         39002 group members
 */

import { Relay, nip29, nip42 } from 'nostr-core'

export const GROUP_CHAT_KIND = 9
export const GROUP_DELETE_KIND = 9005
export const GROUP_JOIN_KIND = 9021
export const GROUP_METADATA_KIND = 39000
export const GROUP_ADMINS_KIND = 39001
export const GROUP_MEMBERS_KIND = 39002

// Single dedicated connection to the group's host relay.
let _relay = null
let _connecting = null
let _getSigner = () => null
let _onAuthed = () => {}

/**
 * Provide the auth signer + a callback fired after a successful relay auth, so
 * the store can reload any members-only content once the handshake completes.
 */
export function configureGroupAuth({ getSigner, onAuthed } = {}) {
  if (getSigner) _getSigner = getSigner
  if (onAuthed) _onAuthed = onAuthed
}

async function ensureRelay(ref) {
  if (_relay?.connected) return _relay
  if (_connecting) return _connecting

  _connecting = (async () => {
    const relay = new Relay(ref.relay)
    relay.onauth = async (challenge) => {
      const signer = _getSigner()
      if (!signer) return // anonymous: metadata is still readable pre-auth
      try {
        const template = nip42.createAuthEventTemplate({ relay: ref.relay, challenge })
        const signed = await signer.signEvent(template)
        await relay.auth(signed)
        _onAuthed()
      } catch (err) {
        console.warn('Group relay auth failed:', err)
      }
    }
    try {
      await relay.connect({ timeout: 8000 })
    } finally {
      _connecting = null
    }
    _relay = relay
    return relay
  })()

  return _connecting
}

/**
 * Live-subscribe to the group with one or more filters. Returns a subscription
 * with a .close() method. Callbacks: { onevent, oneose, onclose }.
 */
export async function subscribeGroup(ref, filter, callbacks) {
  const relay = await ensureRelay(ref)
  return relay.subscribe([filter], callbacks)
}

/**
 * One-shot read: collect events for a filter until EOSE or timeout.
 */
export async function queryGroup(ref, filter, { maxWait = 6000 } = {}) {
  const relay = await ensureRelay(ref)
  return new Promise((resolve) => {
    const events = []
    let sub = null
    const finish = () => {
      clearTimeout(timer)
      try { sub?.close() } catch { /* ignore */ }
      resolve(events)
    }
    const timer = setTimeout(finish, maxWait)
    sub = relay.subscribe([filter], {
      onevent: (e) => events.push(e),
      oneose: finish
    })
  })
}

/**
 * Sign and publish an event to the group relay. Resolves { ok, reason }.
 * NIP-29 groups live on one relay, so there is no partial success.
 */
export async function publishToGroup(ref, signer, template) {
  const relay = await ensureRelay(ref)
  const signed = await signer.signEvent(template)
  try {
    const reason = await relay.publish(signed)
    return { ok: true, reason, event: signed }
  } catch (err) {
    return { ok: false, reason: err?.message || 'rejected', event: signed }
  }
}

// Pure parsers, re-exported so the store stays off nostr-core directly.
export function parseMetadata(event) { return nip29.parseGroupMetadata(event) }
export function parseMembers(event) { return nip29.parseGroupMembers(event) }
export function parseAdmins(event) { return nip29.parseGroupAdmins(event) }

/** Build a kind-9 group chat message template. */
export function buildGroupMessage(ref, content, replyTo) {
  return nip29.createGroupChatTemplate(ref.id, content, replyTo)
}

/**
 * Build a kind-9021 join request. nostr-core has no join helper, so this is the
 * small NIP-29 template inline: content "/join", h-tag for the group.
 */
export function buildJoinRequest(ref, code) {
  const tags = [['h', ref.id]]
  if (code) tags.push(['code', code])
  return {
    kind: GROUP_JOIN_KIND,
    tags,
    content: '/join',
    created_at: Math.floor(Date.now() / 1000)
  }
}

/** Close the group relay connection (call on leaving the view / logout). */
export function disconnectGroup() {
  if (_relay) {
    try { _relay.close() } catch { /* ignore */ }
    _relay = null
  }
  _connecting = null
}
