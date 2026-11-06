import type { AnalyticsFilters, AnalyticsOverview } from '../../../src/shared/analyticsProtocol';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request(path: string, options: RequestInit): Promise<Response> {
  const response = await fetch(path, { ...options, credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.json() as { error: string };
    throw new ApiError(response.status, body.error);
  }
  return response;
}

export async function getSession(signal: AbortSignal): Promise<boolean> {
  const response = await request('/api/auth/session', { signal, cache: 'no-store' });
  const body = await response.json() as { authenticated: boolean };
  return body.authenticated;
}

export async function login(password: string): Promise<void> {
  await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function getAnalytics(filters: AnalyticsFilters, signal: AbortSignal): Promise<AnalyticsOverview> {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.path) query.set('path', filters.path);
  if (filters.referrer) query.set('referrer', filters.referrer);
  if (filters.device) query.set('device', filters.device);
  const response = await request(`/api/me/analytics?${query}`, { signal, cache: 'no-store' });
  return response.json() as Promise<AnalyticsOverview>;
}
