import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const positions = new Map<string, { left: number; top: number }>()
const router = createRouter({
  history: createWebHistory(),
  routes: ['/', '/reminders', '/rules', '/life', '/history'].map(path => ({ path, component: App })),
  scrollBehavior: (to, from, saved) => to.path === from.path ? undefined : saved ?? positions.get(to.path) ?? { left: 0, top: 0 },
})
router.beforeEach((_to, from) => { positions.set(from.path, { left: window.scrollX, top: window.scrollY }) })
createApp(App).use(router).mount('#app')
