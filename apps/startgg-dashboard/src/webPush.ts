import { ApiError, api } from './api'

export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on'

const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

export async function readPushStatus(): Promise<PushStatus> {
  if (!pushSupported) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return (await currentSubscription()) ? 'on' : 'off'
}

export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('未允许浏览器通知，请在浏览器的站点设置中允许通知后再开启')
  await navigator.serviceWorker.register('/sw.js')
  const registration = await navigator.serviceWorker.ready
  const { publicKey } = await api<{ publicKey: string }>('/push/public-key')
  const subscription = (await registration.pushManager.getSubscription())
    ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey }))
  await api('/push/subscriptions', 'PUT', subscription.toJSON())
}

export async function disablePush() {
  const subscription = await currentSubscription()
  if (!subscription) throw new Error('本浏览器没有有效的通知订阅')
  const { endpoint } = subscription
  await api('/push/subscriptions', 'DELETE', { endpoint })
  await subscription.unsubscribe()
}

export async function sendPushTest() {
  const subscription = await currentSubscription()
  if (!subscription) throw new Error('本浏览器没有有效的通知订阅，请点击重新保存')
  try {
    await api('/push/test', 'POST', { endpoint: subscription.endpoint })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new Error('服务器未保存本浏览器订阅，请点击重新保存')
    throw error
  }
}
