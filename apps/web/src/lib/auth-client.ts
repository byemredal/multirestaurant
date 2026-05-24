import type { StoredAuthSession } from '@/lib/storage/auth-session';
import { apiBaseUrl } from '@/lib/config';

export type AuthMode = 'login' | 'signup';
export type SocialProvider = 'google' | 'facebook';

type AuthPayload = {
  accessToken: string;
  csrfToken: string;
  account: StoredAuthSession['account'];
};

export async function bootstrapAuthSession(storedSession: StoredAuthSession) {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${storedSession.accessToken}`,
    },
  });

  if (response.ok) {
    return storedSession;
  }

  const refreshResponse = await fetch(`${apiBaseUrl}/auth/refresh`, {
    credentials: 'include',
    headers: {
      'X-CSRF-Token': storedSession.csrfToken,
    },
    method: 'POST',
  });

  if (!refreshResponse.ok) {
    throw new Error('refresh_failed');
  }

  const payload = await refreshResponse.json() as AuthPayload;
  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    account: payload.account,
  } satisfies StoredAuthSession;
}

export async function loginCustomer(email: string, password: string) {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    body: JSON.stringify({ email, password }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('login_failed');
  }

  const payload = await response.json() as AuthPayload;
  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    account: payload.account,
  } satisfies StoredAuthSession;
}

export async function registerCustomer(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) {
  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    body: JSON.stringify({
      firstName,
      lastName,
      email,
      password,
      phoneNumber: '+900000000000',
    }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('register_failed');
  }

  const payload = await response.json() as AuthPayload;
  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    account: payload.account,
  } satisfies StoredAuthSession;
}

export async function logoutCustomer(session: StoredAuthSession) {
  // Sunucu tarafı oturum iptalini denerken, başarısızlık halinde de
  // yerel oturumun temizlenmesini engellememeliyiz. Token süresi dolmuş veya
  // CSRF eşleşmiyorsa (401/403) bile kullanıcı yine çıkmış sayılır.
  try {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-CSRF-Token': session.csrfToken,
      },
      method: 'POST',
    });
  } catch {
    // Ağ hatası — yerel temizliği yine de yapacağız, caller halleder.
  }
}

export async function beginSocialAuth(
  provider: SocialProvider,
  mode: AuthMode,
  returnTo?: string,
) {
  const url = new URL(`${apiBaseUrl}/auth/oauth/${provider}/start`);
  url.searchParams.set('mode', mode);

  if (returnTo) {
    url.searchParams.set('returnTo', returnTo);
  }

  const response = await fetch(url.toString(), {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`${provider}_oauth_unavailable`);
  }

  const payload = await response.json() as { authorizationUrl?: string };
  if (!payload.authorizationUrl) {
    throw new Error(`${provider}_oauth_missing_url`);
  }

  window.location.href = payload.authorizationUrl;
}

export async function completeSocialAuth(
  provider: SocialProvider,
  input: {
    code?: string | null;
    state?: string | null;
    error?: string | null;
  },
) {
  const response = await fetch(`${apiBaseUrl}/auth/oauth/${provider}/complete`, {
    body: JSON.stringify({
      code: input.code ?? undefined,
      state: input.state ?? undefined,
      error: input.error ?? undefined,
    }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`${provider}_oauth_complete_failed`);
  }

  const payload = (await response.json()) as AuthPayload & { returnTo?: string };
  return {
    session: {
      accessToken: payload.accessToken,
      csrfToken: payload.csrfToken,
      account: payload.account,
    } satisfies StoredAuthSession,
    returnTo: payload.returnTo ?? '/',
  };
}
