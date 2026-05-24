'use client';

import { useState } from 'react';
import { Button, Input } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { setTenantPassword } from '@/lib/tenant-client';
import { readTenantSession, writeTenantSession } from '@/lib/storage/tenant-session';

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Post-approval password setup. Accounts created through passwordless
 * onboarding reach the dashboard with `hasPassword: false` — this prompt lets
 * the partner secure the account so they can sign in with email + password.
 */
export function TenantSetPasswordCard() {
  const { session, syncFromStorage } = useTenantAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!session || session.tenant.hasPassword || done) {
    return null;
  }

  const submit = async () => {
    setError(null);
    if (!PASSWORD_RE.test(password)) {
      setError('Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    try {
      setSaving(true);
      await setTenantPassword(session, password);
      const stored = readTenantSession();
      if (stored) {
        writeTenantSession({
          ...stored,
          tenant: { ...stored.tenant, hasPassword: true },
        });
        syncFromStorage();
      }
      setDone(true);
    } catch {
      setError('Şifre kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-warning-100 bg-warning-50 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-warning-800">
            Hesabınızı güvene alın
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-warning-700">
            Başvurunuz onaylandı. Bir şifre belirleyin — bundan sonra e-posta ve
            şifrenizle giriş yapabilirsiniz.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              placeholder="Yeni şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full sm:w-44"
            />
            <Input
              type="password"
              placeholder="Şifreyi tekrar gir"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 w-full sm:w-44"
            />
          </div>
          <Button
            onClick={() => void submit()}
            disabled={saving}
            className="h-10 shrink-0 rounded-full px-5 text-[14px]"
          >
            {saving ? 'Kaydediliyor…' : 'Şifre belirle'}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mx-auto mt-2 max-w-[1100px] text-[12.5px] text-danger-700">{error}</p>
      ) : null}
    </div>
  );
}
