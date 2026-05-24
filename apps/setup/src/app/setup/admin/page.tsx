'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSetup } from '@/lib/setup-context';
import { SetupButton, setupInputClass } from '@/components/SetupButton';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminStepPage() {
  const router = useRouter();
  const { draft, update } = useSetup();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleContinue = () => {
    const next: Record<string, string> = {};
    const email = draft.adminEmail.trim();

    if (!EMAIL_RE.test(email)) {
      next.adminEmail = 'Geçerli bir e-posta adresi girin.';
    }
    if (draft.adminPassword.length < 8) {
      next.adminPassword = 'En az 8 karakter kullanın.';
    } else if (draft.adminPassword.length > 100) {
      next.adminPassword = 'Parola çok uzun (en fazla 100 karakter).';
    }

    setErrors(next);
    if (Object.keys(next).length === 0) {
      router.push('/setup/complete');
    }
  };

  return (
    <div>
      <span className="inline-flex items-center gap-[7px] rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
        Adım 3 · Super admin
      </span>
      <h1 className="mb-1.5 mt-4 text-2xl font-semibold leading-[1.2] tracking-[-0.02em]">
        Super Admin hesabını oluşturun.
      </h1>
      <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
        Süper yönetici, platformunuzun sahibi ve yöneticisidir. Tüm yönetimsel işlemleri gerçekleştirebilir ve diğer kullanıcı hesaplarını yönetebilir. Bu hesabın güvenliğini sağlamak için güçlü bir şifre kullanmanızı öneririz.
      </p>

      <div className="mt-7 grid gap-4">
        <div className="grid gap-1.5">
          <label
            className="flex items-baseline justify-between gap-2.5 text-[12.5px] font-medium text-ink-soft"
            htmlFor="admin-email"
          >
            E-posta
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            className={setupInputClass(Boolean(errors.adminEmail))}
            placeholder="owner@lieferzonen.com"
            value={draft.adminEmail}
            onChange={(e) => update({ adminEmail: e.target.value })}
          />
          {errors.adminEmail ? (
            <span className="text-[11.5px] text-danger">
              {errors.adminEmail}
            </span>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label
            className="flex items-baseline justify-between gap-2.5 text-[12.5px] font-medium text-ink-soft"
            htmlFor="admin-password"
          >
            Şifre
          </label>
          <div className="relative">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={setupInputClass(Boolean(errors.adminPassword))}
              placeholder="••••••••"
              value={draft.adminPassword}
              onChange={(e) => update({ adminPassword: e.target.value })}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 h-[30px] -translate-y-1/2 cursor-pointer rounded-[7px] bg-transparent px-[9px] text-xs font-medium text-accent-hover hover:bg-surface-muted"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Gizle' : 'Göster'}
            </button>
          </div>
          {errors.adminPassword ? (
            <span className="text-[11.5px] text-danger">
              {errors.adminPassword}
            </span>
          ) : (
            <span className="text-[11.5px] text-ink-muted">
              8–100 karakter kullanın. Güvenli bir yerde saklayın.
            </span>
          )}
        </div>
      </div>

      <div className="mt-7 flex justify-between gap-3 max-[520px]:flex-col-reverse">
        <SetupButton onClick={() => router.push('/setup/country')}>
          Geri
        </SetupButton>
        <SetupButton variant="primary" grow onClick={handleContinue}>
          Devam
        </SetupButton>
      </div>
    </div>
  );
}
