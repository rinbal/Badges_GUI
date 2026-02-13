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
    path: '/requests',
    name: 'requests',
    component: () => import('@/views/RequestsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/surf',
    name: 'surf',
    component: () => import('@/views/SurfView.vue')
  },
  {
    path: '/issued',
    name: 'issued',
    component: () => import('@/views/IssuedView.vue'),
    meta: { requiresAuth: true }
  },
  // Redirects for old URLs
  {
    path: '/postbox',
    redirect: '/requests'
  },
  {
    path: '/awards',
    redirect: '/issued'
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

