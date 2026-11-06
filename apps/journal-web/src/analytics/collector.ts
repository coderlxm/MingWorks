import type { RouteLocationNormalized, Router } from 'vue-router';
import { analyticsPublicPathPattern } from '../../../../src/shared/analyticsProtocol';
import type {
  AnalyticsActivityInput,
  AnalyticsEventInput,
  AnalyticsEventName,
  AnalyticsPageviewInput,
} from '../../../../src/shared/analyticsProtocol';
import { getAnalyticsVisitor, touchAnalyticsSession } from './identity';

interface Pageview {
  id: string;
  visitorId: string;
  sessionId: string;
  path: string;
  activeMs: number;
  visibleSince: number | null;
  ready: Promise<void>;
}

let currentPage: Pageview | null = null;
let stopAnalytics: (() => void) | null = null;
const maxActiveMs = 86_400_000;

export function reportAnalyticsError(error: unknown): void {
  console.error('[Journal analytics]', error);
}

async function postAnalytics(
  endpoint: 'pageviews' | 'activity' | 'events',
  input: AnalyticsPageviewInput | AnalyticsActivityInput | AnalyticsEventInput,
): Promise<void> {
  const response = await fetch(`/api/analytics/${endpoint}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Journal-Visitor-Id': input.visitorId },
    body: JSON.stringify(input),
    keepalive: true,
  });
  if (!response.ok) {
    throw new Error(`Analytics ${endpoint} failed (${response.status}): ${await response.text()}`);
  }
}

function collectVisibleTime(page: Pageview): void {
  if (page.visibleSince === null) return;
  const now = performance.now();
  page.activeMs = Math.min(maxActiveMs, page.activeMs + Math.max(0, now - page.visibleSince));
  page.visibleSince = now;
}

async function sendActivity(page: Pageview): Promise<void> {
  collectVisibleTime(page);
  const input: AnalyticsActivityInput = {
    pageviewId: page.id,
    visitorId: page.visitorId,
    activeMs: Math.round(page.activeMs),
  };
  await page.ready;
  await postAnalytics('activity', input);
}

function closePage(): void {
  const page = currentPage;
  if (page === null) return;
  void sendActivity(page).catch(reportAnalyticsError);
  page.visibleSince = null;
  currentPage = null;
}

function referrerHost(): string {
  if (document.referrer === '') return '';
  const referrer = new URL(document.referrer);
  return referrer.hostname === window.location.hostname ? '' : referrer.hostname;
}

function recordEvent(page: Pageview, name: AnalyticsEventName, target: string): void {
  void (async () => {
    await page.ready;
    await postAnalytics('events', { pageviewId: page.id, visitorId: page.visitorId, name, target });
  })().catch(reportAnalyticsError);
}

function openPage(route: RouteLocationNormalized): void {
  closePage();
  const path = route.path === '/' ? '/' : route.path.replace(/\/$/, '').toLowerCase();
  if (route.name === 'not-found' || !analyticsPublicPathPattern.test(path)) return;
  const visitorId = getAnalyticsVisitor();
  const sessionId = touchAnalyticsSession();
  const query = new URLSearchParams(window.location.search);
  const campaign = (key: string): string => (query.get(key) ?? '').trim().slice(0, 100);
  const input: AnalyticsPageviewInput = {
    id: crypto.randomUUID(),
    visitorId,
    sessionId,
    path,
    referrer: referrerHost(),
    utmSource: campaign('utm_source'),
    utmMedium: campaign('utm_medium'),
    utmCampaign: campaign('utm_campaign'),
  };
  const page: Pageview = {
    id: input.id,
    visitorId,
    sessionId,
    path,
    activeMs: 0,
    visibleSince: document.hidden ? null : performance.now(),
    ready: postAnalytics('pageviews', input),
  };
  currentPage = page;
  void page.ready.catch((error: unknown) => {
    if (currentPage === page) currentPage = null;
    reportAnalyticsError(error);
  });
}

/** Capture the page before a business request so its event cannot move to a later route. */
export function captureAnalyticsRequest(path: string, init?: RequestInit): (() => void) | null {
  const page = currentPage;
  if (page === null) return null;
  const method = (init?.method ?? 'GET').toUpperCase();
  const entry = /^\/api\/entries\/([0-9a-f-]{36})\/(reaction|comments)$/i.exec(path);
  if (entry !== null) {
    if (entry[2] === 'reaction' && method === 'PUT') {
      return () => recordEvent(page, 'reaction', `/p/${entry[1]}`);
    }
    if (entry[2] === 'comments' && method === 'POST') {
      return () => recordEvent(page, 'comment', `/p/${entry[1]}`);
    }
  }
  if (path === '/api/guestbook' && method === 'POST') {
    return () => recordEvent(page, 'guestbook_message', '/guestbook');
  }
  return null;
}

export async function startJournalAnalytics(router: Router): Promise<void> {
  if (navigator.doNotTrack === '1') return;
  await router.isReady();
  stopAnalytics?.();
  openPage(router.currentRoute.value);
  if (router.currentRoute.value.name === 'search' && String(router.currentRoute.value.query.q ?? '').trim()) {
    const page = currentPage;
    if (page !== null) recordEvent(page, 'search', '/search');
  }

  const removeRouteHook = router.afterEach((to, from, failure) => {
    if (failure) return;
    try {
      if (to.path !== from.path) openPage(to);
      if (to.name === 'search' && (to.path !== from.path || to.query.q !== from.query.q) && String(to.query.q ?? '').trim()) {
        const page = currentPage;
        if (page !== null) recordEvent(page, 'search', '/search');
      }
    } catch (error) {
      reportAnalyticsError(error);
    }
  });

  const resumeVisiblePage = (): void => {
    const page = currentPage;
    if (page === null) return;
    if (touchAnalyticsSession() !== page.sessionId) {
      openPage(router.currentRoute.value);
      return;
    }
    page.visibleSince = performance.now();
  };
  const visibilityChanged = (): void => {
    const page = currentPage;
    if (page === null) return;
    if (document.hidden) {
      void sendActivity(page).catch(reportAnalyticsError);
      page.visibleSince = null;
    } else {
      resumeVisiblePage();
    }
  };
  const pageHidden = (): void => closePage();
  const pageShown = (event: PageTransitionEvent): void => {
    if (event.persisted) openPage(router.currentRoute.value);
  };
  const clickedLink = (event: MouseEvent): void => {
    if (event.defaultPrevented || (event.button !== 0 && event.button !== 1)) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    const page = currentPage;
    if (anchor === null || page === null) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    if (url.origin !== window.location.origin) recordEvent(page, 'outbound_click', url.hostname);
    else if (url.pathname === '/api/resume/download') recordEvent(page, 'resume_download_click', '/resume');
  };

  const heartbeat = window.setInterval(() => {
    const page = currentPage;
    if (page === null || document.hidden) return;
    try {
      if (touchAnalyticsSession() !== page.sessionId) openPage(router.currentRoute.value);
      else void sendActivity(page).catch(reportAnalyticsError);
    } catch (error) {
      reportAnalyticsError(error);
    }
  }, 15_000);
  document.addEventListener('visibilitychange', visibilityChanged);
  document.addEventListener('click', clickedLink);
  document.addEventListener('auxclick', clickedLink);
  window.addEventListener('pagehide', pageHidden);
  window.addEventListener('pageshow', pageShown);
  stopAnalytics = () => {
    removeRouteHook();
    window.clearInterval(heartbeat);
    document.removeEventListener('visibilitychange', visibilityChanged);
    document.removeEventListener('click', clickedLink);
    document.removeEventListener('auxclick', clickedLink);
    window.removeEventListener('pagehide', pageHidden);
    window.removeEventListener('pageshow', pageShown);
    closePage();
  };
}

if (import.meta.hot) import.meta.hot.dispose(() => stopAnalytics?.());
