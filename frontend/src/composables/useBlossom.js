/**
 * useBlossom - Composable wrapping media store with auto-fetch, upload queue, toasts
 */

import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'
import { useUIStore } from '@/stores/ui'
import {
  getConfiguredServers,
  list,
  uploadToAll,
  deleteFile,
  signBlossomAuth,
  computeHash,
  BLOSSOM_MAX_FILE_SIZE
} from '@/services/blossom.service'

export function useBlossom({ autoFetch = true } = {}) {
  const authStore = useAuthStore()
  const mediaStore = useMediaStore()
  const uiStore = useUIStore()

  async function refresh() {
    if (!authStore.isAuthenticated || !authStore.hex) return

    mediaStore.isLoading = true
    const servers = getConfiguredServers()

    try {
      const results = await Promise.allSettled(
        servers.map(server => list(server, authStore.hex, authStore.signEvent))
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          mediaStore.mergeFiles(r.value)
        }
      }
    } catch (err) {
      console.error('Failed to fetch media:', err)
    } finally {
      mediaStore.isLoading = false
    }
  }

  async function uploadFiles(fileList) {
    const servers = getConfiguredServers()
    const files = Array.from(fileList)
    const results = []

    for (const file of files) {
      if (file.size > BLOSSOM_MAX_FILE_SIZE) {
        uiStore.showError(`${file.name} exceeds 20 MB limit`)
        continue
      }

      const tempId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`

      mediaStore.uploadQueue.set(tempId, {
        file,
        name: file.name,
        status: 'uploading',
        progress: 0,
        hash: null,
        error: null
      })

      try {
        const result = await uploadToAll(
          file,
          servers,
          authStore.hex,
          authStore.signEvent,
          (progress) => {
            const entry = mediaStore.uploadQueue.get(tempId)
            if (entry) {
              entry.progress = progress
              mediaStore.uploadQueue.set(tempId, { ...entry })
            }
          }
        )

        mediaStore.addFile(result)
        mediaStore.uploadQueue.delete(tempId)
        results.push({ success: true, file: file.name, result })

      } catch (err) {
        const entry = mediaStore.uploadQueue.get(tempId)
        if (entry) {
          entry.status = 'error'
          entry.error = err.message
          mediaStore.uploadQueue.set(tempId, { ...entry })
        }
        results.push({ success: false, file: file.name, error: err.message })
      }
    }

    // Show summary toast
    const successes = results.filter(r => r.success).length
    const failures = results.filter(r => !r.success).length

    if (successes > 0 && failures === 0) {
      uiStore.showSuccess(`Uploaded ${successes} file${successes > 1 ? 's' : ''}`)
    } else if (successes > 0 && failures > 0) {
      uiStore.showWarning(`${successes} uploaded, ${failures} failed`)
    } else if (failures > 0) {
      uiStore.showError(`Upload failed for ${failures} file${failures > 1 ? 's' : ''}`)
    }

    return results
  }

  async function deleteFiles(hashes) {
    const servers = getConfiguredServers()
    let deleted = 0

    for (const hash of hashes) {
      try {
        await Promise.allSettled(
          servers.map(async (server) => {
            const auth = await signBlossomAuth(
              'Delete file', 'delete', authStore.hex, authStore.signEvent, hash
            )
            return deleteFile(server, hash, auth)
          })
        )
        mediaStore.removeFile(hash)
        deleted++
      } catch (err) {
        console.error(`Failed to delete ${hash}:`, err)
      }
    }

    if (deleted > 0) {
      uiStore.showSuccess(`Deleted ${deleted} file${deleted > 1 ? 's' : ''}`)
    }

    return deleted
  }

  // Auto-fetch on mount
  if (autoFetch) {
    onMounted(() => {
      if (authStore.isAuthenticated) {
        refresh()
      }
    })
  }

  return {
    refresh,
    uploadFiles,
    deleteFiles,
    computeHash
  }
}
