/**
 * Staff session storage. INTENTIONALLY isolated from `tenant-session.ts` —
 * staff and tenant owner are distinct subjects, must never share state, and
 * must never accidentally read each other's tokens. Different localStorage
 * key, different shape, different module.
 */

export type StaffAccountSession = {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  /** Active store IDs derived server-side from StaffMembership rows. */
  storeScope: string[];
};

export type StoredStaffSession = {
  accessToken: string;
  csrfToken: string;
  staff: StaffAccountSession;
};

const STAFF_SESSION_KEY = 'auth.staff-session';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function readStaffSession(): StoredStaffSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(STAFF_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredStaffSession;
    if (!parsed.accessToken || !parsed.csrfToken || !parsed.staff?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStaffSession(session: StoredStaffSession) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
}

export function clearStaffSession() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(STAFF_SESSION_KEY);
}
