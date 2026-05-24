export type CustomerAccountSession = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type StoredAuthSession = {
  accessToken: string;
  csrfToken: string;
  account: CustomerAccountSession;
};

const AUTH_SESSION_KEY = 'auth.customer-session';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function readAuthSession(): StoredAuthSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredAuthSession;
    if (!parsed.accessToken || !parsed.csrfToken || !parsed.account?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Same-tab login/logout signal. The `storage` event only fires cross-tab, so
 * we dispatch this for in-tab listeners (e.g. the discovery DiscoveryProvider).
 */
const AUTH_CHANGED_EVENT = 'lieferzonen:auth-changed';

function notifyAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function writeAuthSession(session: StoredAuthSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  notifyAuthChanged();
}

export function clearAuthSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_KEY);
  notifyAuthChanged();
}
