'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Input, PlatformLogo, usePlatformBranding } from '@lieferzonen/ui';
import { apiBaseUrl } from '@/lib/http/tenant-http';
import {
  getPasswordSetupStatus,
  redeemPasswordSetup,
  type PasswordSetupStatus,
} from '@/lib/tenant-password-setup-client';

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

type ViewState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready'; tenantEmail: string; expiresAt: Date }
  | { kind: 'done' };

function deriveView(status: PasswordSetupStatus | null): ViewState {
  if (!status) return { kind: 'loading' };
  if (!status.redeemable) return { kind: 'invalid' };
  return {
    kind: 'ready',
    tenantEmail: status.tenantEmail,
    expiresAt: new Date(status.expiresAt),
  };
}

export default function TenantSetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const rawToken = useMemo(() => {
    const raw = Array.isArray(params.token) ? params.token[0] : params.token;
    return raw ?? '';
  }, [params.token]);

  const [status, setStatus] = useState<PasswordSetupStatus | null>(null);
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const branding = usePlatformBranding(apiBaseUrl);
  const platformName = branding?.platformName?.trim() || 'Platform';

  useEffect(() => {
    if (!rawToken) {
      setView({ kind: 'invalid' });
      return;
    }
    let cancelled = false;
    void getPasswordSetupStatus(rawToken)
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        setView(deriveView(next));
      })
      .catch(() => {
        if (cancelled) return;
        setView({ kind: 'invalid' });
      });
    return () => {
      cancelled = true;
    };
  }, [rawToken]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    if (!PASSWORD_RE.test(password)) {
      setSubmitError('Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.');
      return;
    }
    if (password !== confirm) {
      setSubmitError('Şifreler eşleşmiyor.');
      return;
    }
    try {
      setSubmitting(true);
      await redeemPasswordSetup(rawToken, password);
      setView({ kind: 'done' });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Şifre belirlenirken bir sorun oluştu.');
    } finally {
      setSubmitting(false);
    }
  }, [confirm, password, rawToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-[460px] rounded-3xl border border-ink-200 bg-white p-8 shadow-card">
        <div className="flex justify-center">
          <PlatformLogo apiBaseUrl={apiBaseUrl} height={36} />
        </div>

        {view.kind === 'loading' ? (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-[13.5px] text-ink-500">Bağlantı kontrol ediliyor…</span>
          </div>
        ) : null}

        {view.kind === 'invalid' ? (
          <div className="mt-8 text-center">
            <h1 className="text-[22px] font-bold text-ink-900">Bağlantı geçersiz</h1>
            <p className="mt-2 text-[14px] leading-6 text-ink-600">
              Bu şifre belirleme bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı için
              destek ekibimizle iletişime geçin.
            </p>
            <Button
              className="mt-6 h-11 rounded-full px-6"
              onClick={() => router.push('/login')}
            >
              Giriş ekranına dön
            </Button>
          </div>
        ) : null}

        {view.kind === 'ready' ? (
          <div className="mt-7">
            <h1 className="text-[22px] font-bold text-ink-900">
              {platformName} hesabınız için şifre belirleyin
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-6 text-ink-600">
              <strong className="font-semibold text-ink-800">{view.tenantEmail}</strong> hesabınız için
              yeni bir şifre oluşturun. Bağlantı şu zamana kadar geçerlidir:{' '}
              {view.expiresAt.toLocaleString('tr-TR')}.
            </p>

            <div className="mt-6 grid gap-4">
              <label className="block" htmlFor="new-password">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                  Yeni şifre <span className="text-danger-600" aria-hidden>*</span>
                </span>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-12 rounded-2xl border-ink-200 px-4 text-[15px]"
                  placeholder="En az 8 karakter (büyük + küçük + rakam)"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className="block" htmlFor="new-password-confirm">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                  Şifreyi tekrarla <span className="text-danger-600" aria-hidden>*</span>
                </span>
                <Input
                  id="new-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  className="h-12 rounded-2xl border-ink-200 px-4 text-[15px]"
                  placeholder="Aynı şifreyi yeniden girin"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            {submitError ? (
              <p
                role="alert"
                className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-700"
              >
                {submitError}
              </p>
            ) : null}

            <Button
              className="mt-6 h-12 w-full rounded-full text-[15px]"
              disabled={submitting || !password || !confirm}
              onClick={() => void submit()}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Kaydediliyor…
                </span>
              ) : (
                'Şifreyi kaydet ve giriş yap'
              )}
            </Button>
          </div>
        ) : null}

        {view.kind === 'done' ? (
          <div className="mt-7 text-center">
            <h1 className="text-[22px] font-bold text-ink-900">Şifreniz oluşturuldu</h1>
            <p className="mt-2 text-[14px] leading-6 text-ink-600">
              Artık {platformName} tenant paneline e-posta ve yeni şifrenizle giriş yapabilirsiniz.
            </p>
            <Button
              className="mt-6 h-11 w-full rounded-full"
              onClick={() => router.push('/login')}
            >
              Giriş sayfasına git
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
