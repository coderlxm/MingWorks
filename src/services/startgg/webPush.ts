import webpush, { type PushSubscription, type VapidKeys } from 'web-push';
import { getDb } from '../../reminders/db.js';

export interface StartggPushPayload { title: string; body: string; url: string }

function startggPushVapidKeys(): VapidKeys {
  const db = getDb();
  const keys = db.prepare('SELECT public_key AS publicKey, private_key AS privateKey FROM startgg_push_vapid WHERE id = 1').get() as VapidKeys | undefined;
  if (keys) return keys;
  const generated = webpush.generateVAPIDKeys();
  db.prepare('INSERT INTO startgg_push_vapid(id, public_key, private_key) VALUES (1, ?, ?)').run(generated.publicKey, generated.privateKey);
  return generated;
}

export function startggPushPublicKey(): string {
  return startggPushVapidKeys().publicKey;
}

export function saveStartggPushSubscription(subscription: PushSubscription): void {
  getDb().prepare(`INSERT INTO startgg_push_subscriptions(endpoint, subscription_json, created_at) VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json`).run(subscription.endpoint, JSON.stringify(subscription), new Date().toISOString());
}

export function deleteStartggPushSubscription(endpoint: string): void {
  getDb().prepare('DELETE FROM startgg_push_subscriptions WHERE endpoint = ?').run(endpoint);
}

export async function sendStartggWebPush(payload: StartggPushPayload, endpoint?: string): Promise<void> {
  const db = getDb();
  const rows = (endpoint === undefined
    ? db.prepare('SELECT subscription_json FROM startgg_push_subscriptions').all()
    : db.prepare('SELECT subscription_json FROM startgg_push_subscriptions WHERE endpoint = ?').all(endpoint)) as Array<{ subscription_json: string }>;
  if (endpoint !== undefined && rows.length === 0) {
    throw Object.assign(new Error('订阅未保存，请重新开启浏览器通知。'), { statusCode: 404 });
  }
  const vapidDetails = { subject: 'https://ftg.xmcloud.buzz', ...startggPushVapidKeys() };
  for (const row of rows) {
    const subscription = JSON.parse(row.subscription_json) as PushSubscription;
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), { vapidDetails, TTL: 3600, timeout: 10000 });
    } catch (error) {
      if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        deleteStartggPushSubscription(subscription.endpoint);
        if (endpoint !== undefined) throw Object.assign(new Error('订阅已失效，请重新开启。'), { statusCode: 410 });
      } else {
        const response = error as { statusCode?: number; body?: string };
        throw new Error(`Web Push 发送失败：statusCode=${response.statusCode}, body=${response.body}；${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
  }
}
