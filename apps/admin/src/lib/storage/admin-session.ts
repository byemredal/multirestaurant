export type AdminAccountSession = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
};

export type StoredAdminSession = {
  accessToken: string;
  csrfToken: string;
  admin: AdminAccountSession;
};

const ADMIN_SESSION_KEY = 'auth.admin-session';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function readAdminSession(): StoredAdminSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(ADMIN_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredAdminSession;
    if (!parsed.accessToken || !parsed.csrfToken || !parsed.admin?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeAdminSession(session: StoredAdminSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}
