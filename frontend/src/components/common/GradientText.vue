<script setup>
import { computed } from 'vue'

const props = defineProps({
  text: {
    type: String,
    required: true
  },
  colors: {
    type: Array,
    default: () => ['#9d4edd', '#f59e0b', '#9d4edd']
  },
  animationSpeed: {
    type: Number,
    default: 6
  },
  showBorder: {
    type: Boolean,
    default: false
  }
})

const gradientStyle = computed(() => ({
  backgroundImage: `linear-gradient(to right, ${props.colors.join(', ')})`,
  backgroundSize: '300% 100%',
  '--animation-duration': `${props.animationSpeed}s`
}))

const textStyle = computed(() => ({
  ...gradientStyle.value,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text'
}))

const borderStyle = computed(() => ({
  ...gradientStyle.value
}))
</script>

<template>
  <div class="gradient-text-wrapper">
    <!-- Optional animated border -->
    <div
      v-if="showBorder"
      class="gradient-border animate-gradient"
      :style="borderStyle"
    >
      <div class="gradient-border-inner" />
    </div>

    <!-- Animated gradient text -->
    <span
      class="gradient-text animate-gradient"
      :style="textStyle"
    >
      {{ text }}
    </span>
  </div>
</template>

<style scoped>
.gradient-text-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.gradient-text {
  display: inline-block;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.gradient-border {
  position: absolute;
  inset: -4px;
  border-radius: 1rem;
  z-index: -1;
  pointer-events: none;
}

.gradient-border-inner {
  position: absolute;
  inset: 2px;
  background: var(--color-bg);
  border-radius: calc(1rem - 2px);
}

@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.animate-gradient {
  animation: gradient var(--animation-duration, 6s) ease infinite;
}
</style>
