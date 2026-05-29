'use client';

import { clearStaffSession } from '@/lib/storage/staff-session';
import { clearTenantSession } from '@/lib/storage/tenant-session';

/**
 * Cross-tab auth event channels for the tenant app. Owner and staff are
 * intentionally separate subjects — they have different storage keys, different
 * login routes, and a logout in one subject must never clear the other's
 * session in the same tab or any other tab.
 */

export type TenantAuthSubject = 'owner' | 'staff';
export type TenantAuthEventType = 'logout' | 'session_expired';
export type TenantAuthEventReason =
  | 'manual_logout'
  | 'session_expired'
  | 'refresh_failed';

export type TenantAuthEvent = {
  subject: TenantAuthSubject;
  type: TenantAuthEventType;
  reason: TenantAuthEventReason;
  sourceId: string;
  timestamp: number;
};

const CHANNEL_NAME = 'lz-auth-tenant';
const STORAGE_KEY = 'lz-auth-tenant:event';

const localTabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;
const listeners = new Set<(event: TenantAuthEvent) => void>();
let storageListenerInstalled = false;
let ownerRedirectInFlight = false;
let staffRedirectInFlight = false;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const payload = event.data as TenantAuthEvent | null;
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
      const payload = JSON.parse(event.newValue) as TenantAuthEvent;
      if (payload && payload.sourceId !== localTabId) {
        notifyListeners(payload);
      }
    } catch {
      /* ignore malformed cross-tab payload */
    }
  });
}

function notifyListeners(event: TenantAuthEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* listener errors must not break the broadcast loop */
    }
  });
}

function broadcast(event: TenantAuthEvent) {
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

export function subscribeTenantAuthEvents(
  listener: (event: TenantAuthEvent) => void,
): () => void {
  installStorageListener();
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcastTenantAuthEvent(
  subject: TenantAuthSubject,
  reason: TenantAuthEventReason,
) {
  broadcast({
    subject,
    type: reason === 'manual_logout' ? 'logout' : 'session_expired',
    reason,
    sourceId: localTabId,
    timestamp: Date.now(),
  });
}

function buildLoginUrl(
  base: string,
  reason: 'session_expired' | 'manual_logout',
  returnTo?: string,
): string {
  const params = new URLSearchParams();
  if (reason === 'session_expired') params.set('reason', 'session_expired');
  if (typeof window !== 'undefined') {
    const candidate = returnTo ?? window.location.pathname + window.location.search;
    if (candidate && !candidate.startsWith(base)) {
      params.set('returnTo', candidate);
    }
  }
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ''}`;
}

export function redirectTenantOwnerToLogin(
  reason: 'session_expired' | 'manual_logout' = 'session_expired',
  returnTo?: string,
) {
  if (typeof window === 'undefined') return;
  if (ownerRedirectInFlight) return;
  ownerRedirectInFlight = true;
  window.location.replace(buildLoginUrl('/login', reason, returnTo));
}

export function redirectStaffToLogin(
  reason: 'session_expired' | 'manual_logout' = 'session_expired',
  returnTo?: string,
) {
  if (typeof window === 'undefined') return;
  if (staffRedirectInFlight) return;
  staffRedirectInFlight = true;
  window.location.replace(buildLoginUrl('/staff/login', reason, returnTo));
}

export function triggerTenantOwnerAuthExpiry(
  reason: Extract<TenantAuthEventReason, 'session_expired' | 'refresh_failed'>,
) {
  clearTenantSession();
  broadcastTenantAuthEvent('owner', reason);
  redirectTenantOwnerToLogin('session_expired');
}

export function triggerStaffAuthExpiry(
  reason: Extract<TenantAuthEventReason, 'session_expired' | 'refresh_failed'>,
) {
  clearStaffSession();
  broadcastTenantAuthEvent('staff', reason);
  redirectStaffToLogin('session_expired');
}
