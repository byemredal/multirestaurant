'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { setupAppName } from '@/lib/config';
import { useSetup } from '@/lib/setup-context';
import { Logo } from '@lieferzonen/ui';
import { defaultLogoDataUrl } from '@lieferzonen/assets';

/** The four linear wizard steps, in order. The `/setup` index is the intro. */
export const SETUP_STEPS = [
  { path: '/setup/platform', label: 'Platform', hint: 'İsim & Marka' },
  { path: '/setup/country', label: 'Birincil Ülke', hint: 'Lansman Pazarı' },
  { path: '/setup/admin', label: 'Super Admin', hint: 'Süper Yönetici Hesabı' },
  { path: '/setup/complete', label: 'Kurulum', hint: 'Kurulumu Tamamla' },
] as const;

function activeIndex(pathname: string): number {
  return SETUP_STEPS.findIndex((step) => step.path === pathname);
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

type StepState = 'upcoming' | 'active' | 'done';

const MARKER_BASE =
  'inline-flex items-center justify-center w-[26px] h-[26px] rounded-full ' +
  'border-[1.5px] text-xs font-semibold shrink-0';

const MARKER_BY_STATE: Record<StepState, string> = {
  upcoming: 'border-line-strong bg-white text-ink-muted',
  active: 'border-accent bg-accent text-white',
  done: 'border-success-border bg-success-soft text-success',
};

export function SetupShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { draftRestored, draftDiscarded, reset } = useSetup();
  const current = activeIndex(pathname);
  // On the intro screen nothing is "in progress" yet.
  const stepNumber = current < 0 ? 0 : current + 1;

  return (
    <div className="flex min-h-screen items-stretch justify-center p-6 max-[880px]:p-0">
      <div className="grid w-full max-w-[1080px] grid-cols-[360px_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-white shadow min-h-[calc(100vh-48px)] max-[880px]:min-h-screen max-[880px]:grid-cols-1 max-[880px]:rounded-none max-[880px]:border-0 max-[880px]:shadow-none">
        <aside className="relative flex flex-col gap-7 bg-[linear-gradient(180deg,#fff8ee_0%,#fcebd0_65%,#f7d9a8_100%)] px-8 py-9 max-[880px]:gap-[18px] max-[880px]:px-[22px] max-[880px]:pb-[18px] max-[880px]:pt-[22px]">
          <div className="flex flex-col items-center gap-[11px]">
            <Logo
              src={undefined}
              fallbackSrc={defaultLogoDataUrl}
              fallbackText={setupAppName}
              alt={`${setupAppName} logo`}
              height={36}
            />
            <span>
              <span className="block text-[14.5px] font-semibold tracking-[-0.01em]">
                Platform Bootstrap
              </span>
            </span>
          </div>

          <div className="max-[880px]:hidden">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-hover">
              İlk Çalıştırma Sihirbazı
            </p>
            <h2 className="mb-2 mt-2.5 text-[22px] font-semibold leading-[1.25] tracking-[-0.02em]">
              Platformunuzu kullanıma hazır hale getirin.
            </h2>
            <p className="m-0 text-[13px] leading-[1.6] text-ink-soft">
              Kısa ve tek seferlik bir kurulum: platformunuza bir isim verin, lansman pazarınızı seçin ve süper yönetici hesabını oluşturun.
            </p>
          </div>

          <ol className="mt-auto flex flex-col gap-0.5 max-[880px]:hidden">
            {SETUP_STEPS.map((step, index) => {
              const state: StepState =
                current < 0
                  ? 'upcoming'
                  : index < current
                    ? 'done'
                    : index === current
                      ? 'active'
                      : 'upcoming';
              return (
                <li
                  key={step.path}
                  className={[
                    'flex items-center gap-3 rounded px-3 py-[11px] transition-colors',
                    state === 'active' ? 'bg-white/70' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span
                    className={`${MARKER_BASE} ${MARKER_BY_STATE[state]}`}
                  >
                    {state === 'done' ? <CheckIcon /> : index + 1}
                  </span>
                  <span>
                    <span
                      className={[
                        'block text-[13px]',
                        state === 'active'
                          ? 'font-semibold text-ink'
                          : 'font-medium text-ink-soft',
                      ].join(' ')}
                    >
                      {step.label}
                    </span>
                    <span className="mt-px block text-[11.5px] text-ink-muted">
                      {step.hint}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="flex min-w-0 flex-col px-11 py-10 max-[880px]:px-[22px] max-[880px]:pb-9 max-[880px]:pt-[26px]">
          <div className="m-auto w-full max-w-[440px]">
            {current >= 0 ? (
              <div className="mb-[22px] hidden max-[880px]:block">
                <div className="mb-[7px] flex justify-between text-xs text-ink-muted">
                  <span>
                    Step {stepNumber} of {SETUP_STEPS.length}
                  </span>
                  <span>{SETUP_STEPS[current].label}</span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200"
                    style={{
                      width: `${(stepNumber / SETUP_STEPS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {draftRestored || draftDiscarded ? (
              <div
                className={[
                  'mb-5 rounded border px-[13px] py-[11px] text-[12.5px] leading-[1.5]',
                  draftRestored
                    ? 'border-success-border bg-success-soft text-success'
                    : 'border-line-strong bg-surface-muted text-ink-soft',
                ].join(' ')}
                role="status"
              >
                <div className="flex items-start justify-between gap-3 max-[520px]:flex-col">
                  <span>
                    {draftRestored
                      ? 'Yarım kalan kurulum taslağı geri yüklendi. Güvenlik nedeniyle admin şifresi ve bootstrap anahtarı yeniden girilmelidir.'
                      : 'Eski veya bozuk kurulum taslağı temizlendi. Baştan devam edebilirsiniz.'}
                  </span>
                  {draftRestored ? (
                    <button
                      type="button"
                      className="shrink-0 text-[12px] font-semibold underline underline-offset-2"
                      onClick={reset}
                    >
                      Taslağı temizle ve baştan başla
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
