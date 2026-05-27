import { SMOKE_CONFIG } from './config';

export interface AdminSession {
  accessToken: string;
  csrfToken: string;
  admin: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Direct-API admin login. Used when a smoke needs to perform admin actions
 * server-side (e.g. capture the password-setup debugLink from a resend
 * response) without first driving the admin UI login form.
 */
export async function loginAdminViaApi(
  email = SMOKE_CONFIG.adminEmail,
  password = SMOKE_CONFIG.adminPassword,
): Promise<AdminSession> {
  const response = await fetch(`${SMOKE_CONFIG.apiBaseUrl}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`admin login failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return (await response.json()) as AdminSession;
}

export function adminAuthHeaders(session: AdminSession): Record<string, string> {
  return {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Hit the admin resend endpoint and return the parsed body. Smokes use this
 * to capture the dev-only `debugLink` (which carries the raw password setup
 * token in NODE_ENV != production) so the password-setup browser smoke does
 * not need to scrape an e-mail.
 */
export async function resendPasswordSetupViaApi(
  session: AdminSession,
  applicationId: string,
): Promise<{
  passwordSetup: {
    deliveryStatus: string;
    deliveryErrorCode: string | null;
    sentToEmail: string | null;
    tokenIssued: boolean;
    debugLink?: string | null;
  };
}> {
  const response = await fetch(
    `${SMOKE_CONFIG.apiBaseUrl}/admin/tenant-applications/${applicationId}/password-setup/resend`,
    {
      method: 'POST',
      headers: adminAuthHeaders(session),
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`resend failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return (await response.json()) as Awaited<ReturnType<typeof resendPasswordSetupViaApi>>;
}
