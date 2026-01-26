<template>
  <component
    :is="iconComponent"
    :size="sizeValue"
    :stroke-width="strokeWidth"
    :class="['icon', `icon--${size}`, { 'icon--spin': spin }]"
  />
</template>

<script setup>
import { computed } from 'vue'
import {
  IconHome,
  IconInbox,
  IconMail,
  IconMailbox,
  IconPlus,
  IconSend,
  IconAward,
  IconMedal,
  IconStar,
  IconTrophy,
  IconUser,
  IconUsers,
  IconKey,
  IconLock,
  IconShield,
  IconPuzzle,
  IconCheck,
  IconCircleCheck,
  IconX,
  IconCircleX,
  IconAlertCircle,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconChevronRight,
  IconChevronLeft,
  IconArrowRight,
  IconArrowLeft,
  IconExternalLink,
  IconCopy,
  IconTrash,
  IconEdit,
  IconRefresh,
  IconSearch,
  IconFilter,
  IconPhoto,
  IconUpload,
  IconWorld,
  IconBolt,
  IconClock,
  IconLogout,
  IconMenu,
  IconDotsVertical,
  IconTemplate,
  IconSparkles,
  IconLoader2,
  IconLayoutGrid,
  IconEye,
  IconEyeOff
} from '@tabler/icons-vue'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(v)
  },
  strokeWidth: {
    type: Number,
    default: 1.5
  },
  spin: {
    type: Boolean,
    default: false
  }
})

const sizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 26,
  xl: 36
}

const sizeValue = computed(() => sizes[props.size] || 22)

// Map icon names to Tabler icon components
const icons = {
  // Navigation & Actions
  'home': IconHome,
  'inbox': IconInbox,
  'mail': IconMail,
  'mailbox': IconMailbox,
  'postbox': IconMailbox,
  'create': IconPlus,
  'plus': IconPlus,
  'send': IconSend,

  // Badge & Award
  'badge': IconMedal,
  'award': IconAward,
  'medal': IconMedal,
  'star': IconStar,
  'trophy': IconTrophy,

  // User & Profile
  'user': IconUser,
  'users': IconUsers,

  // Auth & Security
  'key': IconKey,
  'lock': IconLock,
  'shield': IconShield,
  'extension': IconPuzzle,
  'puzzle': IconPuzzle,

  // Status & Feedback
  'check': IconCheck,
  'check-circle': IconCircleCheck,
  'x': IconX,
  'close': IconX,
  'x-circle': IconCircleX,
  'alert-circle': IconAlertCircle,
  'info': IconInfoCircle,

  // UI Elements
  'chevron-down': IconChevronDown,
  'chevron-up': IconChevronUp,
  'chevron-right': IconChevronRight,
  'chevron-left': IconChevronLeft,
  'arrow-right': IconArrowRight,
  'arrow-left': IconArrowLeft,
  'external-link': IconExternalLink,

  // Actions
  'copy': IconCopy,
  'trash': IconTrash,
  'delete': IconTrash,
  'edit': IconEdit,
  'refresh': IconRefresh,
  'search': IconSearch,
  'filter': IconFilter,

  // Media & Content
  'image': IconPhoto,
  'photo': IconPhoto,
  'upload': IconUpload,

  // Misc
  'globe': IconWorld,
  'world': IconWorld,
  'zap': IconBolt,
  'bolt': IconBolt,
  'clock': IconClock,
  'logout': IconLogout,
  'menu': IconMenu,
  'more-vertical': IconDotsVertical,
  'template': IconTemplate,
  'grid': IconLayoutGrid,
  'sparkles': IconSparkles,
  'loader': IconLoader2,
  'eye': IconEye,
  'eye-off': IconEyeOff
}

const iconComponent = computed(() => {
  const component = icons[props.name]
  if (!component) {
    console.warn(`Icon "${props.name}" not found, using fallback`)
    return IconAlertCircle
  }
  return component
})
</script>

<style scoped>
.icon {
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}

.icon--spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
