<template>
  <div class="media-page">
    <header class="page-header">
      <h1>Media</h1>
      <p class="subtitle">Upload and manage your files on decentralized Blossom servers</p>
    </header>

    <MediaLibrary />
  </div>
</template>

<script setup>
import MediaLibrary from '@/components/media/MediaLibrary.vue'
</script>

<style scoped>
.media-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header h1 {
  margin: 0 0 0.25rem;
  color: var(--color-text);
}

.subtitle {
  color: var(--color-text-muted);
  margin: 0;
}

@media (max-width: 768px) {
  .media-page {
    padding: 1.25rem;
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .media-page {
    padding: 1rem 0.75rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.875rem;
  }
}
</style>
