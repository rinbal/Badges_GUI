/**
 * Media Store - Manages blossom media files, uploads, filtering, and selection
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMediaStore = defineStore('media', () => {
  // File library keyed by SHA-256 hash
  const files = ref(new Map())

  // Upload queue keyed by temp ID
  const uploadQueue = ref(new Map())

  // Filters
  const filterType = ref('all') // 'all' | 'image' | 'video' | 'audio'
  const sortBy = ref('newest')  // 'newest' | 'oldest' | 'largest' | 'smallest'

  // Selection
  const selectedFiles = ref(new Set())

  // Loading
  const isLoading = ref(false)

  // Computed: filtered files
  const filteredFiles = computed(() => {
    const all = Array.from(files.value.values())
    if (filterType.value === 'all') return all
    return all.filter(f => {
      if (!f.type) return false
      if (filterType.value === 'image') return f.type.startsWith('image/')
      if (filterType.value === 'video') return f.type.startsWith('video/')
      if (filterType.value === 'audio') return f.type.startsWith('audio/')
      return true
    })
  })

  // Computed: sorted files
  const sortedFiles = computed(() => {
    const arr = [...filteredFiles.value]
    switch (sortBy.value) {
      case 'newest':
        return arr.sort((a, b) => (b.created || 0) - (a.created || 0))
      case 'oldest':
        return arr.sort((a, b) => (a.created || 0) - (b.created || 0))
      case 'largest':
        return arr.sort((a, b) => (b.size || 0) - (a.size || 0))
      case 'smallest':
        return arr.sort((a, b) => (a.size || 0) - (b.size || 0))
      default:
        return arr
    }
  })

  // Computed: image-only files (for picker)
  const imageFiles = computed(() => {
    return Array.from(files.value.values())
      .filter(f => f.type && f.type.startsWith('image/'))
      .sort((a, b) => (b.created || 0) - (a.created || 0))
  })

  const selectedCount = computed(() => selectedFiles.value.size)

  const fileCount = computed(() => files.value.size)

  const imageCount = computed(() =>
    Array.from(files.value.values()).filter(f => f.type?.startsWith('image/')).length
  )

  const videoCount = computed(() =>
    Array.from(files.value.values()).filter(f => f.type?.startsWith('video/')).length
  )

  const audioCount = computed(() =>
    Array.from(files.value.values()).filter(f => f.type?.startsWith('audio/')).length
  )

  const totalSize = computed(() =>
    Array.from(files.value.values()).reduce((sum, f) => sum + (f.size || 0), 0)
  )

  // Actions

  function addFile(fileData) {
    const existing = files.value.get(fileData.hash)
    if (existing) {
      // Merge URLs and servers
      const mergedUrls = [...new Set([...(existing.urls || []), ...(fileData.urls || [fileData.url])])]
      const mergedServers = [...new Set([...(existing.servers || []), ...(fileData.servers || [])])]
      files.value.set(fileData.hash, {
        ...existing,
        ...fileData,
        urls: mergedUrls,
        servers: mergedServers,
        url: mergedUrls[0]
      })
    } else {
      files.value.set(fileData.hash, {
        ...fileData,
        urls: fileData.urls || [fileData.url],
        servers: fileData.servers || []
      })
    }
  }

  function mergeFiles(fileList) {
    for (const f of fileList) {
      const hash = f.sha256 || f.hash
      if (!hash) continue

      const url = f.url || ''
      const serverUrl = url ? new URL(url).origin : ''

      addFile({
        hash,
        url,
        urls: url ? [url] : [],
        size: f.size || 0,
        type: f.type || guessMimeType(url),
        created: f.created || f.uploaded || 0,
        servers: serverUrl ? [serverUrl] : []
      })
    }
  }

  function removeFile(hash) {
    files.value.delete(hash)
    selectedFiles.value.delete(hash)
  }

  function toggleSelection(hash) {
    if (selectedFiles.value.has(hash)) {
      selectedFiles.value.delete(hash)
    } else {
      selectedFiles.value.add(hash)
    }
  }

  function clearSelection() {
    selectedFiles.value.clear()
  }

  function clearAll() {
    files.value.clear()
    selectedFiles.value.clear()
    uploadQueue.value.clear()
  }

  return {
    files,
    uploadQueue,
    filterType,
    sortBy,
    selectedFiles,
    isLoading,
    filteredFiles,
    sortedFiles,
    imageFiles,
    selectedCount,
    fileCount,
    imageCount,
    videoCount,
    audioCount,
    totalSize,
    addFile,
    mergeFiles,
    removeFile,
    toggleSelection,
    clearSelection,
    clearAll
  }
})

/** Guess MIME type from URL extension */
function guessMimeType(url) {
  if (!url) return ''
  const ext = url.split('.').pop()?.toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav'
  }
  return map[ext] || ''
}
