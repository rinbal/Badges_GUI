<template>
  <div
    :class="['user-avatar', `size-${size}`, { clickable }]"
    @click="handleClick"
  >
    <img
      v-if="picture && !imageError"
      :src="picture"
      :alt="name || 'User'"
      class="avatar-image"
      @error="handleError"
    />
    <div v-else class="avatar-placeholder">
      {{ initials }}
    </div>
    <div v-if="showOnlineIndicator" class="online-indicator"></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  picture: {
    type: String,
    default: null
  },
  name: {
    type: String,
    default: ''
  },
  pubkey: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md', // 'xs', 'sm', 'md', 'lg', 'xl'
    validator: (v) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(v)
  },
  clickable: {
    type: Boolean,
    default: false
  },
  showOnlineIndicator: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const imageError = ref(false)

const initials = computed(() => {
  if (props.name) {
    return props.name.slice(0, 2).toUpperCase()
  }
  if (props.pubkey) {
    return props.pubkey.slice(0, 2).toUpperCase()
  }
  return '??'
})

function handleError() {
  imageError.value = true
}

function handleClick() {
  if (props.clickable) {
    emit('click', props.pubkey)
  }
}
</script>

<style scoped>
.user-avatar {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar.clickable {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.user-avatar.clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

/* Sizes */
.size-xs {
  width: 24px;
  height: 24px;
  font-size: 0.625rem;
}

.size-sm {
  width: 32px;
  height: 32px;
  font-size: 0.75rem;
}

.size-md {
  width: 40px;
  height: 40px;
  font-size: 0.875rem;
}

.size-lg {
  width: 56px;
  height: 56px;
  font-size: 1.125rem;
}

.size-xl {
  width: 80px;
  height: 80px;
  font-size: 1.5rem;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-surface-elevated) 100%);
  color: var(--color-primary);
  font-weight: 600;
  font-family: var(--font-mono);
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 25%;
  height: 25%;
  min-width: 8px;
  min-height: 8px;
  background: var(--color-success);
  border-radius: 50%;
  border: 2px solid var(--color-surface);
}
</style>
