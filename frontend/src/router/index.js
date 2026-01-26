import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue')
  },
  {
    path: '/creator',
    name: 'creator',
    component: () => import('@/views/CreatorView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/inbox',
    name: 'inbox',
    component: () => import('@/views/InboxView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile/:pubkey?',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue')
  },
  {
    path: '/postbox',
    name: 'postbox',
    component: () => import('@/views/PostboxView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/surf',
    name: 'surf',
    component: () => import('@/views/SurfView.vue')
  },
  {
    path: '/awards',
    name: 'awards',
    component: () => import('@/views/MyAwardsView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router

