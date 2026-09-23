import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
const positions = new Map<string, { left: number; top: number }>()
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: App }, { path: '/events/:eventId', component: App }, { path: '/following', component: App }],
  scrollBehavior: (to, from, saved) => to.path === from.path ? undefined : saved ?? positions.get(to.path) ?? { left: 0, top: 0 },
})
router.beforeEach((_to, from) => { positions.set(from.path, { left: window.scrollX, top: window.scrollY }) })
createApp(App).use(router).mount('#app')
// 页面资源（含外部字体样式表）加载完成后，再取回看板实际用到的字重，确保开场层退出时字体已就位
const displayFonts = ['600 1em "Barlow Condensed"', '700 1em "Barlow Condensed"', '800 1em "Barlow Condensed"', 'italic 800 1em "Barlow Condensed"']
window.addEventListener('load', async () => {
  await Promise.all(displayFonts.map(font => document.fonts.load(font)))
  const boot = document.getElementById('boot')!
  boot.classList.add('is-leaving')
  await Promise.all(boot.getAnimations({ subtree: true }).map(animation => animation.finished))
  boot.remove()
}, { once: true })
