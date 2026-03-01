/**
 * Blossom Service - Core API for decentralized media uploads
 *
 * Handles SHA-256 hashing, NIP-98 auth signing, upload, mirror, list, and delete
 * operations against Blossom-compatible servers.
 */

import { api } from '@/api/client'

export const BLOSSOM_SERVER = 'https://blossom.band'

export const DEFAULT_BLOSSOM_SERVERS = [
  'https://blossom.band',
  'https://nostr.build',
  'https://cdn.satellite.earth'
]

export const BLOSSOM_MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const STORAGE_KEY = 'blossom_servers'

/**
 * Compute SHA-256 hex digest of a file
 */
export async function computeHash(file) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Create a kind 24242 Blossom auth event and sign it
 * @param {string} content - Description of the action
 * @param {string} method - HTTP method: 'upload', 'delete', or 'list'
 * @param {string} pubkey - Hex pubkey
 * @param {Function} signEvent - Auth store's signEvent function
 * @param {string} [hash] - SHA-256 hash for upload/delete
 * @returns {Promise<string|null>} Base64-encoded signed event or null
 */
export async function signBlossomAuth(content, method, pubkey, signEvent, hash = null) {
  const expiration = Math.floor(Date.now() / 1000) + 300 // 5 minutes

  const tags = [
    ['t', method],
    ['expiration', String(expiration)]
  ]

  if (hash) {
    tags.push(['x', hash])
  }

  const unsignedEvent = {
    kind: 24242,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content
  }

  const signed = await signEvent(unsignedEvent)
  if (!signed) return null

  return btoa(JSON.stringify(signed))
}

/**
 * Upload a file to a blossom server via XHR (for progress tracking)
 */
export function upload(server, file, hash, auth, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${server.replace(/\/$/, '')}/upload`)

    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    if (auth) {
      xhr.setRequestHeader('Authorization', `Nostr ${auth}`)
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({ url: `${server}/${hash}` })
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload network error')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

    xhr.send(file)
  })
}

/**
 * Mirror a file to another blossom server
 */
export async function mirror(server, url, auth) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    headers['Authorization'] = `Nostr ${auth}`
  }

  const resp = await fetch(`${server.replace(/\/$/, '')}/mirror`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ url })
  })

  if (!resp.ok) {
    throw new Error(`Mirror failed: ${resp.status}`)
  }

  return resp.json()
}

/**
 * Upload to first server, then mirror to remaining servers in parallel
 */
export async function uploadToAll(file, servers, pubkey, signEvent, onProgress) {
  if (!servers.length) throw new Error('No servers configured')

  const hash = await computeHash(file)

  // Upload to primary server
  const primaryServer = servers[0]
  const uploadAuth = await signBlossomAuth('Upload file', 'upload', pubkey, signEvent, hash)
  const result = await upload(primaryServer, file, hash, uploadAuth, onProgress)

  const primaryUrl = result.url || `${primaryServer}/${hash}`
  const urls = [primaryUrl]
  const successServers = [primaryServer]

  // Mirror to remaining servers in parallel
  if (servers.length > 1) {
    const mirrorResults = await Promise.allSettled(
      servers.slice(1).map(async (server) => {
        const mirrorAuth = await signBlossomAuth('Mirror file', 'upload', pubkey, signEvent, hash)
        await mirror(server, primaryUrl, mirrorAuth)
        const mirrorUrl = `${server.replace(/\/$/, '')}/${hash}`
        return { server, url: mirrorUrl }
      })
    )

    for (const r of mirrorResults) {
      if (r.status === 'fulfilled') {
        urls.push(r.value.url)
        successServers.push(r.value.server)
      }
    }
  }

  return {
    hash,
    url: primaryUrl,
    urls,
    servers: successServers,
    size: file.size,
    type: file.type,
    created: Math.floor(Date.now() / 1000)
  }
}

/**
 * List files from a blossom server via backend proxy
 */
export async function list(server, pubkey, signEvent) {
  let auth = null
  if (signEvent) {
    auth = await signBlossomAuth('List files', 'list', pubkey, signEvent)
  }

  const resp = await api.blossomList(server, pubkey, auth)
  return resp.data
}

/**
 * Delete a file from a blossom server
 */
export async function deleteFile(server, hash, auth) {
  const headers = {}
  if (auth) {
    headers['Authorization'] = `Nostr ${auth}`
  }

  const resp = await fetch(`${server.replace(/\/$/, '')}/${hash}`, {
    method: 'DELETE',
    headers
  })

  if (!resp.ok) {
    throw new Error(`Delete failed: ${resp.status}`)
  }

  return true
}

/**
 * Get configured blossom servers from localStorage or defaults
 */
export function getConfiguredServers() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return [...DEFAULT_BLOSSOM_SERVERS]
}

/**
 * Save configured servers to localStorage
 */
export function setConfiguredServers(servers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers))
}
