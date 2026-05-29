'use client';

import { clearAdminSession } from '@/lib/storage/admin-session';

const CHANNEL_NAME = 'lz-auth-admin';
const STORAGE_KEY = 'lz-auth-admin:event';

export type AdminAuthEventType = 'logout' | 'session_expired';
export type AdminAuthEventReason =
  | 'manual_logout'
  | 'session_expired'
  | 'refresh_failed';

export type AdminAuthEvent = {
  type: AdminAuthEventType;
  reason: AdminAuthEventReason;
  sourceId: string;
  timestamp: number;
};

const localTabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;
const listeners = new Set<(event: AdminAuthEvent) => void>();
let storageListenerInstalled = false;
let redirectInFlight = false;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const payload = event.data as AdminAuthEvent | null;
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
      const payload = JSON.parse(event.newValue) as AdminAuthEvent;
      if (payload && payload.sourceId !== localTabId) {
        notifyListeners(payload);
      }
    } catch {
      /* ignore malformed cross-tab payload */
    }
  });
}

function notifyListeners(event: AdminAuthEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* listener errors must not break the broadcast loop */
    }
  });
}

function broadcast(event: AdminAuthEvent) {
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

export function subscribeAdminAuthEvents(
  listener: (event: AdminAuthEvent) => void,
): () => void {
  installStorageListener();
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcastAdminAuthEvent(reason: AdminAuthEventReason) {
  broadcast({
    type: reason === 'manual_logout' ? 'logout' : 'session_expired',
    reason,
    sourceId: localTabId,
    timestamp: Date.now(),
  });
}

export function redirectAdminToLogin(
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
  if (candidate && !candidate.startsWith('/login')) {
    params.set('returnTo', candidate);
  }
  const qs = params.toString();
  window.location.replace(`/login${qs ? `?${qs}` : ''}`);
}

export function triggerAdminAuthExpiry(
  reason: Extract<AdminAuthEventReason, 'session_expired' | 'refresh_failed'>,
) {
  clearAdminSession();
  broadcastAdminAuthEvent(reason);
  redirectAdminToLogin('session_expired');
}
