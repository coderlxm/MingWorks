const visitorKey = 'journal.analytics.visitor';
const sessionKey = 'journal.analytics.session';
const sessionTimeoutMs = 30 * 60 * 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AnalyticsSession {
  id: string;
  lastSeen: number;
}

export function getAnalyticsVisitor(): string {
  const stored = localStorage.getItem(visitorKey);
  if (stored !== null) {
    if (!uuidPattern.test(stored)) throw new Error('Journal analytics visitor identity is invalid.');
    return stored;
  }
  const id = crypto.randomUUID();
  localStorage.setItem(visitorKey, id);
  return id;
}

export function touchAnalyticsSession(): string {
  const now = Date.now();
  const stored = localStorage.getItem(sessionKey);
  let session: AnalyticsSession;
  if (stored !== null) {
    session = JSON.parse(stored) as AnalyticsSession;
    if (!uuidPattern.test(session.id) || !Number.isFinite(session.lastSeen)) {
      throw new Error('Journal analytics session identity is invalid.');
    }
    if (now - session.lastSeen >= sessionTimeoutMs) session = { id: crypto.randomUUID(), lastSeen: now };
  } else {
    session = { id: crypto.randomUUID(), lastSeen: now };
  }
  session.lastSeen = now;
  localStorage.setItem(sessionKey, JSON.stringify(session));
  return session.id;
}
