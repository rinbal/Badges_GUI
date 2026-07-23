/**
 * NIP-46 remote signing (Amber, nsec.app, any "bunker").
 *
 * The whole app talks to a signer through one shape: getPublicKey, signEvent,
 * and a nested nip44.encrypt/decrypt (the nostr-core Signer interface). This
 * module connects to a remote signer and exposes exactly that shape, so a
 * remote signer drops into authStore.getSigner() with no call-site changes.
 *
 * Why our own client instead of nostr-core's NostrConnect: the current NIP-46
 * spec encrypts the kind-24133 RPC with NIP-44, and current signers (Amber)
 * only speak NIP-44. nostr-core's built-in client still uses legacy NIP-04, so
 * the handshake silently stalls (neither side can read the other). We implement
 * the client here over NIP-44, reusing nostr-core's nip44 + event signing.
 *
 * Two pairing directions, both ending in a connected client:
 *   - nostrconnect:// (this app starts it) - we show a QR; the signer approves
 *     and sends back an ack whose result echoes our secret. The ack's author is
 *     the remote signer, which is how we learn its pubkey.
 *   - bunker:// (the signer gives you the link) - the URI carries the remote
 *     pubkey + relays, so we connect and send a connect request directly.
 */

import {
  createSecretKeySigner,
  parseConnectionURI,
  Relay,
  nip44,
  generateSecretKey,
  getPublicKey,
  bytesToHex,
  hexToBytes,
  randomBytes
} from 'nostr-core'

/** NIP-46 RPC events live on kind 24133. */
const NIP46_KIND = 24133
const REQUEST_TIMEOUT_MS = 60_000

/**
 * Handshake relays for the nostrconnect:// flow. Pairing only works on relays
 * the SIGNER also uses, and almost nobody changes their signer's defaults, so
 * this mirrors Amber's default "external app" relay set (the dominant signer),
 * plus nos.lol for breadth. The bunker:// flow ignores these and uses the
 * relays from the pasted URI instead.
 */
export const NIP46_RELAYS = [
  'wss://relay.nsec.app',
  'wss://nostr.oxtr.dev',
  'wss://relay.primal.net',
  'wss://theforest.nostr1.com',
  'wss://nos.lol'
]

/** Permissions we ask the signer to pre-approve, so the user is not prompted on
 *  every encrypt/sign. These are exactly what the app uses. */
const NIP46_PERMS = ['sign_event', 'nip44_encrypt', 'nip44_decrypt'].join(',')

const BRAND = 'BadgeBox'

/**
 * A NIP-46 client over NIP-44 transport. Holds relay sockets and matches
 * responses to requests by id. Satisfies the app's signer shape.
 */
class Nip46Client {
  constructor({ clientSecret, remotePubkey, relays, userPubkey }) {
    this.clientSecret = clientSecret
    this.clientPubkey = getPublicKey(clientSecret)
    this.remotePubkey = remotePubkey
    this.relays = relays
    // The user pubkey when already known from a saved record. Lets getPublicKey
    // answer instantly on restore instead of round-tripping to a possibly-asleep
    // signer for something we already recorded at pairing time.
    this.knownUserPubkey = userPubkey || null
    // Shared NIP-44 conversation key (ECDH is symmetric, so it both en/decrypts).
    this.convKey = nip44.getConversationKey(clientSecret, remotePubkey)
    this.eventSigner = createSecretKeySigner(clientSecret)
    this.conns = []
    this.subs = []
    this.pending = new Map()
  }

  /**
   * Connect to every reachable handshake relay and subscribe for the signer's
   * replies on each. The signer may answer on any of them (and may switch relays
   * mid-session), so betting on a single relay is what makes pairings stall.
   */
  async open() {
    const connected = await Promise.all(
      this.relays.map(async (url) => {
        const relay = new Relay(url)
        try {
          await relay.connect({ timeout: 6000 })
          return relay
        } catch {
          return null
        }
      })
    )

    // A relay can pass connect() and then drop right before we subscribe;
    // nostr-core's subscribe() sends synchronously and can throw. Guard each one
    // so a single flaky relay cannot abort the whole session.
    for (const relay of connected) {
      if (!relay) continue
      try {
        const sub = relay.subscribe(
          [{ kinds: [NIP46_KIND], authors: [this.remotePubkey], '#p': [this.clientPubkey] }],
          { onevent: (event) => this.handleResponse(event) }
        )
        this.subs.push(sub)
        this.conns.push(relay)
      } catch {
        try { relay.close() } catch { /* ignore */ }
      }
    }

    if (!this.conns.length) throw new Error('Could not reach any of the signer relays.')
  }

  /** bunker flow: announce the connection (with the URI secret if present). */
  async sendConnect(secret) {
    await this.request('connect', secret ? [this.clientPubkey, secret] : [this.clientPubkey])
  }

  getPublicKey() {
    // On restore the account pubkey is already known (saved at pairing). Answer
    // from it so re-login never blocks on a get_public_key round-trip to a
    // possibly-asleep signer; the first real signing request proves it is live.
    if (this.knownUserPubkey) return Promise.resolve(this.knownUserPubkey)
    return this.request('get_public_key', [])
  }

  async signEvent(event) {
    return JSON.parse(await this.request('sign_event', [JSON.stringify(event)]))
  }

  nip44 = {
    encrypt: (pubkey, plaintext) => this.request('nip44_encrypt', [pubkey, plaintext]),
    decrypt: (pubkey, ciphertext) => this.request('nip44_decrypt', [pubkey, ciphertext])
  }

  close() {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('Connection closed'))
      this.pending.delete(id)
    }
    for (const sub of this.subs) {
      try { sub.close() } catch { /* ignore */ }
    }
    this.subs = []
    for (const relay of this.conns) {
      try { relay.close() } catch { /* ignore */ }
    }
    this.conns = []
  }

  toRecord() {
    return {
      clientSecretKey: bytesToHex(this.clientSecret),
      remotePubkey: this.remotePubkey,
      relays: this.relays
    }
  }

  async request(method, params) {
    if (!this.conns.length) throw new Error('Remote signer is not connected.')
    const id = bytesToHex(randomBytes(16))
    const content = nip44.encrypt(JSON.stringify({ id, method, params }), this.convKey)
    const signed = await this.eventSigner.signEvent({
      kind: NIP46_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', this.remotePubkey]],
      content
    })

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`The signer did not respond (${method}).`))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      // Broadcast to every relay; the first matching response (by id) wins.
      for (const relay of this.conns) relay.publish(signed).catch(() => {})
    })
  }

  handleResponse(event) {
    let response
    try {
      response = JSON.parse(nip44.decrypt(event.content, this.convKey))
    } catch {
      return // not ours / undecryptable
    }
    const pending = this.pending.get(response.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(response.id)
    if (response.error) pending.reject(new Error(response.error))
    else pending.resolve(response.result ?? '')
  }
}

/**
 * Build a nostrconnect:// URI to show as a QR / deep link. It carries our
 * ephemeral pubkey, the handshake relays, an unguessable one-shot secret (the
 * signer echoes it back so we know the approval is for this URI), and the
 * permissions we want pre-granted.
 */
export function createNostrConnectURI(meta = {}) {
  const clientSecretKey = generateSecretKey()
  const clientPubkey = getPublicKey(clientSecretKey)
  const secret = bytesToHex(randomBytes(16))

  const params = new URLSearchParams({
    secret,
    perms: NIP46_PERMS,
    name: meta.name || BRAND,
    url: meta.url || (typeof window !== 'undefined' ? window.location.origin : '')
  })
  for (const r of NIP46_RELAYS) params.append('relay', r)

  return {
    uri: `nostrconnect://${clientPubkey}?${params.toString()}`,
    clientSecretKey,
    secret,
    relays: [...NIP46_RELAYS]
  }
}

/**
 * Wait for the signer to approve our nostrconnect:// URI, then return a
 * connected signer plus its reconnect record. The approval is a kind-24133 event
 * p-tagged to us whose NIP-44-decrypted result is our secret (some signers send
 * "ack"); the event's author is the remote signer. Wire signal to a cancel button.
 */
export async function awaitNostrConnect(handshake, signal) {
  const { clientSecretKey, secret, relays } = handshake
  const clientPubkey = getPublicKey(clientSecretKey)
  const since = Math.floor(Date.now() / 1000)

  const remotePubkey = await new Promise((resolve, reject) => {
    const conns = []
    let settled = false

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort)
      for (const r of conns) {
        try { r.close() } catch { /* best effort */ }
      }
    }
    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('Pairing cancelled', 'AbortError'))
    }
    if (signal?.aborted) return onAbort()
    signal?.addEventListener('abort', onAbort)

    const onEvent = (event) => {
      if (settled) return
      let payload
      try {
        // The author is the (still-unknown) signer; derive the key from it.
        const convKey = nip44.getConversationKey(clientSecretKey, event.pubkey)
        payload = JSON.parse(nip44.decrypt(event.content, convKey))
      } catch {
        return // not the ack we are waiting for
      }
      if (payload.result !== secret && payload.result !== 'ack') return
      settled = true
      cleanup()
      resolve(event.pubkey)
    }

    for (const url of relays) {
      const relay = new Relay(url)
      conns.push(relay)
      relay
        .connect({ timeout: 8000 })
        .then(() => relay.subscribe([{ kinds: [NIP46_KIND], '#p': [clientPubkey], since }], { onevent: onEvent }))
        .catch(() => { /* one relay down is fine as long as another carries the approval */ })
    }
  })

  const client = new Nip46Client({ clientSecret: clientSecretKey, remotePubkey, relays })
  await client.open()
  return { signer: client, record: client.toRecord() }
}

/**
 * A signer's own relays unioned with our standard set. Amber also listens on
 * theforest + relay.nsec.app by default, so merging the defaults in keeps a
 * bunker account reachable even when the single relay saved from its pairing
 * link has gone stale. Harmless when the signer does not use the extras.
 */
function withDefaultRelays(relays) {
  return [...new Set([...(relays || []), ...NIP46_RELAYS])]
}

/**
 * Connect to a pasted bunker:// (or nostrconnect://) URI. The URI carries the
 * remote pubkey, relays, and optionally a one-shot secret; we mint a fresh
 * ephemeral client key so future reconnects are recognized without re-pairing.
 */
export async function connectBunker(uri) {
  const { remotePubkey, relayUrls, secret } = parseConnectionURI(uri.trim())
  const client = new Nip46Client({
    clientSecret: generateSecretKey(),
    remotePubkey,
    relays: withDefaultRelays(relayUrls)
  })
  await client.open()
  // open() has opened live sockets; if the connect handshake fails, close them
  // so a rejected/timed-out pairing cannot leak connections + subscriptions.
  try {
    await client.sendConnect(secret)
  } catch (err) {
    client.close()
    throw err
  }
  return { signer: client, record: client.toRecord() }
}

/** Rebuild a previously paired signer from its persisted record (on reload). */
export async function restoreNip46Signer(record, knownUserPubkey) {
  const client = new Nip46Client({
    clientSecret: hexToBytes(record.clientSecretKey),
    remotePubkey: record.remotePubkey,
    relays: withDefaultRelays(record.relays),
    userPubkey: knownUserPubkey
  })
  await client.open()
  // Re-announce, but do NOT block restore on it. An already-authorized app is
  // usually auto-acked, yet a sleeping mobile signer can take up to the request
  // timeout to answer; the first real request handles a signer still waking up.
  client.sendConnect().catch(() => { /* proceed with the connection we have */ })
  return client
}
