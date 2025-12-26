<template>
  <div 
    :class="['skeleton', variant]"
    :style="customStyle"
  ></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'text',
    validator: (v) => ['text', 'circle', 'rect', 'button'].includes(v)
  },
  width: {
    type: String,
    default: null
  },
  height: {
    type: String,
    default: null
  }
})

const customStyle = computed(() => ({
  width: props.width,
  height: props.height
}))
</script>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Variants */
.skeleton.text {
  height: 1rem;
  width: 100%;
  border-radius: var(--radius-sm);
}

.skeleton.circle {
  border-radius: 50%;
}

.skeleton.rect {
  border-radius: var(--radius-md);
}

.skeleton.button {
  height: 2.5rem;
  width: 6rem;
  border-radius: var(--radius-md);
}
</style>

