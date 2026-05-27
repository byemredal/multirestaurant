import { apiBaseUrl } from '@/lib/http/tenant-http';

export type PasswordSetupStatus =
  | {
      redeemable: true;
      tenantEmail: string;
      expiresAt: string;
    }
  | {
      redeemable: false;
      reason: 'invalid_or_expired_token' | string;
    };

export async function getPasswordSetupStatus(rawToken: string): Promise<PasswordSetupStatus> {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/password-setup/${encodeURIComponent(rawToken)}/status`,
    { cache: 'no-store' },
  );
  // Endpoint deliberately returns 200 for every state (see backend).
  if (!response.ok) {
    return { redeemable: false, reason: `unexpected_status_${response.status}` };
  }
  return (await response.json()) as PasswordSetupStatus;
}

export async function redeemPasswordSetup(
  rawToken: string,
  password: string,
): Promise<{ tenantAccountId: string; passwordSet: true }> {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/password-setup/${encodeURIComponent(rawToken)}/redeem`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
  );
  if (!response.ok) {
    let message = 'Şifre belirlenirken bir sorun oluştu.';
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string' && payload.message) {
        message = payload.message;
      } else if (Array.isArray(payload?.message) && payload.message.length > 0) {
        message = payload.message.join(', ');
      }
    } catch {
      /* keep generic fallback */
    }
    throw new Error(message);
  }
  return (await response.json()) as { tenantAccountId: string; passwordSet: true };
}
