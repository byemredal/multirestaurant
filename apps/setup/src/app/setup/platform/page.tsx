'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { MAX_LOGO_BYTES } from '@/lib/config';
import { useSetup } from '@/lib/setup-context';
import { SetupButton, setupInputClass } from '@/components/SetupButton';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FILE_BUTTON_BASE =
  'inline-flex h-7 cursor-pointer items-center rounded-sm border px-[11px] ' +
  'text-xs font-medium';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

export default function PlatformStepPage() {
  const router = useRouter();
  const { draft, update } = useSetup();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file (PNG, SVG or JPG).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo is too large. Keep it under 64 KB for setup.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      update({ logoUrl: dataUrl, logoFileName: file.name });
    } catch {
      setLogoError('That file could not be read. Try another image.');
    }
  };

  const removeLogo = () => {
    update({ logoUrl: '', logoFileName: '' });
    setLogoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleContinue = () => {
    const next: Record<string, string> = {};
    const name = draft.platformName.trim();
    const email = draft.supportEmail.trim();

    if (name.length < 2) {
      next.platformName = 'Enter a platform name (at least 2 characters).';
    }
    if (!EMAIL_RE.test(email)) {
      next.supportEmail = 'Enter a valid support email address.';
    }

    setErrors(next);
    if (Object.keys(next).length === 0) {
      router.push('/setup/country');
    }
  };

  return (
    <div>
      <span className="inline-flex items-center gap-[7px] rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
        Adım 1 · Platform
      </span>
      <h1 className="mb-1.5 mt-4 text-2xl font-semibold leading-[1.2] tracking-[-0.02em]">
        Platform Bilgi
      </h1>
      <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
        Platformunuzun adı, destek e-posta adresi ve logosu gibi temel bilgileri sağlayarak başlayın. Bu bilgiler, platformunuzun görünümünü ve iletişim kanallarını özelleştirmenize yardımcı olacaktır.
      </p>

      <div className="mt-7 grid gap-4">
        <div className="grid gap-1.5">
          <label
            className="flex items-baseline justify-between gap-2.5 text-[12.5px] font-medium text-ink-soft"
            htmlFor="platform-name"
          >
            Platform Adı
          </label>
          <input
            id="platform-name"
            className={setupInputClass(Boolean(errors.platformName))}
            placeholder="Lieferzonen"
            value={draft.platformName}
            maxLength={120}
            onChange={(e) => update({ platformName: e.target.value })}
          />
          {errors.platformName ? (
            <span className="text-[11.5px] text-danger">
              {errors.platformName}
            </span>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label
            className="flex items-baseline justify-between gap-2.5 text-[12.5px] font-medium text-ink-soft"
            htmlFor="support-email"
          >
            Destek E-postası
          </label>
          <input
            id="support-email"
            type="email"
            className={setupInputClass(Boolean(errors.supportEmail))}
            placeholder="support@lieferzonen.com"
            value={draft.supportEmail}
            onChange={(e) => update({ supportEmail: e.target.value })}
          />
          {errors.supportEmail ? (
            <span className="text-[11.5px] text-danger">
              {errors.supportEmail}
            </span>
          ) : (
            <span className="text-[11.5px] text-ink-muted">
              Kullanıcılara gönderilen destek e-postalarının adresi.
            </span>
          )}
        </div>

        <div className="grid gap-1.5">
          <span className="flex items-baseline justify-between gap-2.5 text-[12.5px] font-medium text-ink-soft">
            Logo
            <span className="text-[11px] font-medium text-ink-faint">
              Opsiyonel
            </span>
          </span>
          <div className="flex items-center gap-3.5 rounded-lg border border-dashed border-line-strong bg-surface-muted p-3.5">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-white">
              {draft.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={draft.logoUrl}
                  alt="Platform logo preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-ink-faint">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.8" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-ink">
                {draft.logoFileName || 'Logo gönderilmedi'}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-muted">
                PNG, SVG or JPG · up to 64 KB
              </div>
              <div className="mt-2 flex gap-2">
                <label
                  className={`${FILE_BUTTON_BASE} border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink`}
                >
                  {draft.logoUrl ? 'Replace' : 'Logo Yükle'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleLogoChange}
                  />
                </label>
                {draft.logoUrl ? (
                  <button
                    type="button"
                    className={`${FILE_BUTTON_BASE} border-danger-border bg-white text-danger`}
                    onClick={removeLogo}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          {logoError ? (
            <span className="text-[11.5px] text-danger">{logoError}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-7 flex justify-between gap-3 max-[520px]:flex-col-reverse">
        <SetupButton onClick={() => router.push('/setup')}>Geri</SetupButton>
        <SetupButton variant="primary" grow onClick={handleContinue}>
          Devam
        </SetupButton>
      </div>
    </div>
  );
}
