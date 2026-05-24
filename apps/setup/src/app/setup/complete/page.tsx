'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SETUP_COUNTRIES, adminLoginUrl } from '@/lib/config';
import {
  initializePlatform,
  SetupApiError,
  type SetupStatus,
} from '@/lib/setup-api';
import { useSetup } from '@/lib/setup-context';
import {
  SetupButton,
  setupButtonClass,
  setupInputClass,
} from '@/components/SetupButton';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROR_COPY: Record<string, string> = {
  api_unreachable:
    'Arka uç API\'sine ulaşılamadı. Çalışır durumda olduğundan emin olun ve tekrar deneyin.',
  invalid_bootstrap_key:
    'Bootstrap anahtarı reddedildi. Anahtarı kontrol edin ve tekrar deneyin.',
  bootstrap_key_not_configured:
    'Kurulum yapılamıyor: sunucuda hiçbir BOOTSTRAP_KEY yapılandırılmamış.',
  setup_disabled:
    'Kurulum devre dışı bırakıldı: platform zaten başlatılmış veya kurulum kilitlenmiş olabilir.',
  already_initialized:
    'Platform zaten başlatılmış görünüyor. Kurulum tamamlanmış olabilir.',
  initialization_in_progress:
    'Başlatma işlemi zaten devam ediyor olabilir. Birkaç dakika bekleyin ve tekrar deneyin.',
  invalid_input:
    'Girdi doğrulanamadı. Lütfen sağladığınız bilgileri gözden geçirin ve tekrar deneyin.',
  rate_limited: 'Çok fazla başarısız deneme oldu. Lütfen birkaç dakika bekleyin ve tekrar deneyin.',
  initialize_failed: 'Platform başlatılamadı. Lütfen sağladığınız bilgileri gözden geçirin ve tekrar deneyin.',
};

function countryName(code: string): string {
  return SETUP_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-[13px] first:border-t-0">
      <span className="text-[12.5px] text-ink-muted">{label}</span>
      <span className="break-words text-right text-[13px] font-medium text-ink">
        {value}
      </span>
    </div>
  );
}

export default function CompleteStepPage() {
  const router = useRouter();
  const { draft, update } = useSetup();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupStatus | null>(null);

  // Once initialization succeeds, hand off to the admin panel sign-in.
  useEffect(() => {
    if (!result) return undefined;
    const timer = window.setTimeout(() => {
      window.location.replace(adminLoginUrl);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [result]);

  // Gaps in data collected on earlier steps (the bootstrap key is entered here).
  const missing = useMemo(() => {
    const gaps: string[] = [];
    if (draft.platformName.trim().length < 2) gaps.push('platform Adı');
    if (!EMAIL_RE.test(draft.supportEmail.trim())) gaps.push('destek emaili');
    if (!draft.primaryCountry) gaps.push('birincil ülke');
    if (!EMAIL_RE.test(draft.adminEmail.trim())) gaps.push('admin emaili');
    if (draft.adminPassword.length < 8) gaps.push('admin şifresi');
    return gaps;
  }, [draft]);

  const handleInitialize = async () => {
    if (submitting) return;
    if (!draft.bootstrapKey.trim()) {
      setKeyError('Platform bootstrap anahtarını girin.');
      return;
    }
    setKeyError(null);
    setSubmitting(true);
    setError(null);
    try {
      const status = await initializePlatform({
        platformName: draft.platformName.trim(),
        supportEmail: draft.supportEmail.trim(),
        logoUrl: draft.logoUrl || undefined,
        primaryCountry: draft.primaryCountry,
        adminEmail: draft.adminEmail.trim(),
        adminPassword: draft.adminPassword,
        bootstrapKey: draft.bootstrapKey.trim(),
      });
      setResult(status);
    } catch (err) {
      const code = err instanceof SetupApiError ? err.code : 'initialize_failed';
      setError(ERROR_COPY[code] ?? ERROR_COPY.initialize_failed);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success ──────────────────────────────────────────────── */
  if (result) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-9 text-center">
        <span className="inline-flex h-[60px] w-[60px] items-center justify-center rounded-full border border-success-border bg-success-soft text-success">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className="text-[15px] font-semibold text-ink">
          Platform başlatıldı
        </span>
        <p className="max-w-[340px] text-[13px] leading-[1.55] text-ink-muted">
          {result.platform?.platformName ?? draft.platformName} Hazır. Sistem artık <strong>HAZIR</strong> ve kurulum tamamlandı. Yönetici paneli giriş sayfasına yönlendiriliyorsunuz…
        </p>
        <a className={setupButtonClass({ variant: 'primary' })} href={adminLoginUrl}>
          Admin paneline git
        </a>
      </div>
    );
  }

  /* ── Incomplete draft guard ───────────────────────────────── */
  if (missing.length > 0) {
    return (
      <div>
        <span className="inline-flex items-center gap-[7px] rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
          Adım 4 · Başlat
        </span>
        <h1 className="mb-1.5 mt-4 text-2xl font-semibold leading-[1.2] tracking-[-0.02em]">
          Birkaç detay eksik
        </h1>
        <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
          Başlatmadan önce, şu alanları tamamlayın: {missing.join(', ')}.
        </p>
        <div className="mt-7 flex justify-between gap-3 max-[520px]:flex-col-reverse">
          <SetupButton onClick={() => router.push('/setup/admin')}>
            Geri
          </SetupButton>
          <SetupButton
            variant="primary"
            grow
            onClick={() => router.push('/setup/platform')}
          >
            Adımları gözden geçir
          </SetupButton>
        </div>
      </div>
    );
  }

  /* ── Loading ──────────────────────────────────────────────── */
  if (submitting) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-9 text-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-surface-muted border-t-accent"
          aria-hidden
        />
        <span className="text-[15px] font-semibold text-ink">
          Platform başlatılıyor…
        </span>
        <p className="max-w-[340px] text-[13px] leading-[1.55] text-ink-muted">
          Süper yönetici hesabı oluşturuluyor ve platform yapılandırması kaydediliyor.
        </p>
      </div>
    );
  }

  /* ── Review + confirm ─────────────────────────────────────── */
  return (
    <div>
      <span className="inline-flex items-center gap-[7px] rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
        Adım 4 · Başlat
      </span>
      <h1 className="mb-1.5 mt-4 text-2xl font-semibold leading-[1.2] tracking-[-0.02em]">
        Gözden geçir ve başlat
      </h1>
      <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
        Aşağıdaki detayları onaylayın. Başlatma işlemi bir kez çalıştırılır ve tekrarlanamaz.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <SummaryRow label="Platform name" value={draft.platformName.trim()} />
        <SummaryRow label="Support email" value={draft.supportEmail.trim()} />
        <SummaryRow
          label="Logo"
          value={draft.logoFileName || 'Not provided'}
        />
        <SummaryRow
          label="Primary country"
          value={countryName(draft.primaryCountry)}
        />
        <SummaryRow label="Super admin" value={draft.adminEmail.trim()} />
      </div>

      <div className="mt-7 grid gap-4">
        <div className="grid gap-1.5">
          <label
            className="flex items-baseline justify-between gap-2.5 text-[12.5px] font-medium text-ink-soft"
            htmlFor="bootstrap-key"
          >
            Bootstrap anahtarı
          </label>
          <input
            id="bootstrap-key"
            type="password"
            autoComplete="off"
            className={setupInputClass(Boolean(keyError))}
            placeholder="Platform bootstrap anahtarını girin"
            value={draft.bootstrapKey}
            onChange={(e) => update({ bootstrapKey: e.target.value })}
          />
          {keyError ? (
            <span className="text-[11.5px] text-danger">{keyError}</span>
          ) : (
            <span className="text-[11.5px] text-ink-muted">
              Platform bootstrap anahtarı. Başlatma işlemi için gereklidir.
            </span>
          )}
        </div>
      </div>

      {error ? (
        <div
          className="mt-5 flex gap-[9px] rounded border border-danger-border bg-danger-soft px-[13px] py-[11px] text-[12.5px] leading-[1.5] text-danger"
          role="alert"
        >
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-7 flex justify-between gap-3 max-[520px]:flex-col-reverse">
        <SetupButton onClick={() => router.push('/setup/admin')}>
          Geri
        </SetupButton>
        <SetupButton
          variant="primary"
          grow
          onClick={() => void handleInitialize()}
        >
          Platformı başlat
        </SetupButton>
      </div>
    </div>
  );
}
