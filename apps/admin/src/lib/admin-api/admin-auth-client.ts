import { apiBaseUrl } from '@/lib/config';
import type { StoredAdminSession } from '@/lib/storage/admin-session';
import { parseJsonResponse } from './http';

type AdminAuthPayload = {
  accessToken: string;
  csrfToken: string;
  admin: StoredAdminSession['admin'];
};

export async function loginAdmin(email: string, password: string) {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/admin/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('admin_api_unreachable');
  }

  if (!response.ok) {
    throw new Error(`admin_login_failed_${response.status}`);
  }

  const payload = (await parseJsonResponse(response)) as AdminAuthPayload;

  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    admin: payload.admin,
  } satisfies StoredAdminSession;
}

export async function bootstrapAdminSession(session: StoredAdminSession) {
  const response = await fetch(`${apiBaseUrl}/admin/auth/me`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (response.ok) {
    return session;
  }

  const refreshResponse = await fetch(`${apiBaseUrl}/admin/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': session.csrfToken,
    },
  });

  if (!refreshResponse.ok) {
    throw new Error('admin_refresh_failed');
  }

  const payload = (await parseJsonResponse(refreshResponse)) as AdminAuthPayload;

  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    admin: payload.admin,
  } satisfies StoredAdminSession;
}

export async function logoutAdmin(session: StoredAdminSession) {
  const response = await fetch(`${apiBaseUrl}/admin/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-CSRF-Token': session.csrfToken,
    },
  });

  if (!response.ok) {
    throw new Error('admin_logout_failed');
  }

  return parseJsonResponse(response);
}
