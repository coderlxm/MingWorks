import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { rememberEventLocation } from './eventNavigation'
import { initialBoardRead } from './initialBoardRead'
import './style.css'
const positions = new Map<string, { left: number; top: number }>()
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: App }, { path: '/events/:eventId', component: App }, { path: '/following', component: App }],
  scrollBehavior: (to, from, saved) => to.path === from.path ? undefined : saved ?? positions.get(to.path) ?? { left: 0, top: 0 },
})
router.beforeEach((_to, from) => { positions.set(from.path, { left: window.scrollX, top: window.scrollY }) })
router.afterEach((to, _from, failure) => {
  if (!failure && typeof to.params.eventId === 'string') rememberEventLocation(to.params.eventId, to.fullPath)
})
createApp(App).use(router).mount('#app')
// 页面资源、实际字重和首屏数据均就绪后，再退出开场层。
const displayFonts = ['600 1em "Barlow Condensed"', '700 1em "Barlow Condensed"', '800 1em "Barlow Condensed"', 'italic 800 1em "Barlow Condensed"']
window.addEventListener('load', async () => {
  await Promise.all([initialBoardRead, ...displayFonts.map(font => document.fonts.load(font))])
  const boot = document.getElementById('boot')!
  boot.classList.add('is-leaving')
  await Promise.all(boot.getAnimations({ subtree: true }).map(animation => animation.finished))
  boot.remove()
}, { once: true })
