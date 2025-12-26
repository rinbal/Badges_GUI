<template>
  <div :class="['spinner-container', size]">
    <div class="spinner"></div>
    <span v-if="text" class="spinner-text">{{ text }}</span>
  </div>
</template>

<script setup>
defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  text: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.spinner {
  border-radius: 50%;
  border-style: solid;
  border-color: var(--color-primary);
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

.sm .spinner {
  width: 1.25rem;
  height: 1.25rem;
  border-width: 2px;
}

.md .spinner {
  width: 2rem;
  height: 2rem;
  border-width: 3px;
}

.lg .spinner {
  width: 3rem;
  height: 3rem;
  border-width: 4px;
}

.spinner-text {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

