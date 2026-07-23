<template>
  <div class="group-msg" :class="{ mine: message.isMine }">
    <img
      v-if="!message.isMine && profile?.picture"
      :src="profile.picture"
      alt=""
      class="gm-avatar"
      @error="brokenAvatar = true"
    />
    <div
      v-else-if="!message.isMine"
      class="gm-avatar gm-avatar--ph"
    >
      <Icon name="user" size="xs" />
    </div>

    <div class="gm-body">
      <span v-if="!message.isMine" class="gm-name">{{ displayName }}</span>
      <div class="gm-bubble">
        <p class="gm-text">{{ message.content }}</p>
        <span class="gm-time">{{ time }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({
  message: { type: Object, required: true },
  profile: { type: Object, default: null }
})

const brokenAvatar = ref(false)

const displayName = computed(() => {
  if (props.profile?.name) return props.profile.name
  const pk = props.message.pubkey || ''
  return pk ? `${pk.slice(0, 8)}...${pk.slice(-4)}` : 'Anonymous'
})

const time = computed(() => {
  const ts = props.message.created_at
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})
</script>

<style scoped>
.group-msg {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
  max-width: 85%;
}

.group-msg.mine {
  margin-left: auto;
  flex-direction: row-reverse;
}

.gm-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.gm-avatar--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-hover);
  color: var(--color-text-subtle);
}

.gm-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.gm-name {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0 0 0.1875rem 0.625rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gm-bubble {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-lg);
  background: var(--color-surface-hover);
  border-bottom-left-radius: var(--radius-sm);
}

.mine .gm-bubble {
  background: var(--color-primary);
  border-bottom-left-radius: var(--radius-lg);
  border-bottom-right-radius: var(--radius-sm);
}

.gm-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.mine .gm-text {
  color: #fff;
  font-weight: 500;
}

.gm-time {
  display: block;
  margin-top: 0.1875rem;
  font-size: 0.625rem;
  color: var(--color-text-subtle);
  text-align: right;
}

.mine .gm-time {
  color: rgba(255, 255, 255, 0.75);
}
</style>
