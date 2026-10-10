// 首次注册后立即接管已打开的看板页面，点击通知时才能导航这些窗口。
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const { title, body, url } = event.data.json()
  event.waitUntil(self.registration.showNotification(title, { body, data: { url }, tag: url }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url } = event.notification.data
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const sameOrigin = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (sameOrigin) {
      const client = await sameOrigin.navigate(url)
      await client.focus()
    } else {
      await self.clients.openWindow(url)
    }
  })())
})
