'use client';

import { clearAuthSession } from '@/lib/storage/auth-session';

/**
 * Customer-app cross-tab auth event channel. Mirrors admin + tenant: a
 * BroadcastChannel with a localStorage storage-event fallback for older
 * browsers. The customer auth-session module already fires AUTH_CHANGED_EVENT
 * same-tab via writeAuthSession / clearAuthSession; this helper adds the
 * explicit cross-tab + session_expired discriminator and the redirect that
 * the centralized webAuthedFetch needs to bounce a stale session to /login
 * cleanly.
 */

export type WebAuthEventType = 'logout' | 'session_expired';
export type WebAuthEventReason =
  | 'manual_logout'
  | 'session_expired'
  | 'refresh_failed';

export type WebAuthEvent = {
  type: WebAuthEventType;
  reason: WebAuthEventReason;
  sourceId: string;
  timestamp: number;
};

const CHANNEL_NAME = 'lz-auth-web';
const STORAGE_KEY = 'lz-auth-web:event';

const localTabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;
const listeners = new Set<(event: WebAuthEvent) => void>();
let storageListenerInstalled = false;
let redirectInFlight = false;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const payload = event.data as WebAuthEvent | null;
      if (payload && payload.sourceId !== localTabId) {
        notifyListeners(payload);
      }
    };
  } catch {
    channel = null;
  }
  return channel;
}

function installStorageListener() {
  if (storageListenerInstalled || typeof window === 'undefined') return;
  storageListenerInstalled = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as WebAuthEvent;
      if (payload && payload.sourceId !== localTabId) {
        notifyListeners(payload);
      }
    } catch {
      /* ignore malformed cross-tab payload */
    }
  });
}

function notifyListeners(event: WebAuthEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* listener errors must not break the broadcast loop */
    }
  });
}

function broadcast(event: WebAuthEvent) {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(event);
    } catch {
      /* posting failed — storage fallback below still runs */
    }
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage blocked — best effort */
    }
  }
}

export function subscribeWebAuthEvents(
  listener: (event: WebAuthEvent) => void,
): () => void {
  installStorageListener();
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcastWebAuthEvent(reason: WebAuthEventReason) {
  broadcast({
    type: reason === 'manual_logout' ? 'logout' : 'session_expired',
    reason,
    sourceId: localTabId,
    timestamp: Date.now(),
  });
}

export function redirectCustomerToLogin(
  reason: 'session_expired' | 'manual_logout' = 'session_expired',
  returnTo?: string,
) {
  if (typeof window === 'undefined') return;
  if (redirectInFlight) return;
  redirectInFlight = true;
  const params = new URLSearchParams();
  if (reason === 'session_expired') params.set('reason', 'session_expired');
  const candidate =
    returnTo ?? window.location.pathname + window.location.search;
  if (candidate && !candidate.startsWith('/login') && candidate !== '/') {
    params.set('returnTo', candidate);
  }
  const qs = params.toString();
  window.location.replace(`/login${qs ? `?${qs}` : ''}`);
}

export function triggerWebAuthExpiry(
  reason: Extract<WebAuthEventReason, 'session_expired' | 'refresh_failed'>,
) {
  clearAuthSession();
  broadcastWebAuthEvent(reason);
  redirectCustomerToLogin('session_expired');
}
