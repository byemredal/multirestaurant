import type { TenantStatus } from '@/lib/auth/tenant-status';

export type TenantAccountSession = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  /** Coarse, routing-relevant lifecycle state computed by the API. */
  status: TenantStatus;
  /** Raw 8-value onboarding status — kept for messaging detail only. */
  onboardingStatus: string;
  verificationStatus: string;
  /** False while the account is still in the passwordless onboarding flow. */
  hasPassword: boolean;
};

export type StoredTenantSession = {
  accessToken: string;
  csrfToken: string;
  tenant: TenantAccountSession;
};

const TENANT_SESSION_KEY = 'auth.tenant-session';
const TENANT_CONTINUATION_KEY = 'auth.tenant-continuation';
const TENANT_ONBOARDING_STATE_TOKEN_KEY = 'auth.tenant-onboarding-state-token';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function readTenantSession(): StoredTenantSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(TENANT_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredTenantSession;
    if (!parsed.accessToken || !parsed.csrfToken || !parsed.tenant?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeTenantSession(session: StoredTenantSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TENANT_SESSION_KEY, JSON.stringify(session));
}

export function clearTenantSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TENANT_SESSION_KEY);
}

/**
 * The onboarding continuation token — a long-lived, single-purpose credential
 * that lets a partner resume a half-finished application later. It is stored
 * separately from the session so it survives a session expiry / sign-out.
 */
export function readContinuationToken(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(TENANT_CONTINUATION_KEY);
}

export function writeContinuationToken(token: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TENANT_CONTINUATION_KEY, token);
}

export function clearContinuationToken() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TENANT_CONTINUATION_KEY);
}

export function readOnboardingStateToken(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(TENANT_ONBOARDING_STATE_TOKEN_KEY);
}

export function writeOnboardingStateToken(stateToken: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TENANT_ONBOARDING_STATE_TOKEN_KEY, stateToken);
}

export function clearOnboardingStateToken() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TENANT_ONBOARDING_STATE_TOKEN_KEY);
}
