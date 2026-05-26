'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SETUP_COUNTRIES } from '@/lib/config';
import { useSetup } from '@/lib/setup-context';
import { SetupButton } from '@/components/SetupButton';

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

const COUNTRY_BASE =
  'flex w-full items-center gap-3.5 rounded-lg border px-4 py-[15px] text-left ' +
  'transition-[border-color,box-shadow,background] duration-100';

export default function CountryStepPage() {
  const router = useRouter();
  const { draft, update } = useSetup();
  const [navTarget, setNavTarget] = useState<'back' | 'next' | null>(null);

  const goBack = () => {
    setNavTarget('back');
    router.push('/setup/platform');
  };
  const goNext = () => {
    setNavTarget('next');
    router.push('/setup/admin');
  };

  return (
    <div>
      <span className="inline-flex items-center gap-[7px] rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
        Adım 2 · Ülke
      </span>
      <h1 className="mb-1.5 mt-4 text-2xl font-semibold leading-[1.2] tracking-[-0.02em]">
        Birincil Pazarınızı Seçin
      </h1>
      <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
        Platformun başlatıldığı pazar. Yerel para birimi, dil, vergi ve hukuki
        doküman varsayılanları seçtiğiniz ülkenin CountryPack tanımından gelir.
      </p>

      <div className="mt-7 grid gap-2.5">
        {SETUP_COUNTRIES.map((country) => {
          const active = draft.primaryCountry === country.code;
          return (
            <button
              key={country.code}
              type="button"
              className={[
                COUNTRY_BASE,
                active
                  ? 'border-accent bg-accent-soft shadow-[0_0_0_3px_rgba(249,115,22,0.12)]'
                  : 'border-line bg-white hover:border-line-strong',
              ].join(' ')}
              aria-pressed={active}
              onClick={() => update({ primaryCountry: country.code })}
            >
              <span className="text-[26px] leading-none" aria-hidden>
                {country.flag}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {country.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {country.code} · {country.currency} · {country.locale}
                </span>
              </span>
              <span
                className={[
                  'inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                  active
                    ? 'border-accent bg-accent text-white'
                    : 'border-line-strong text-transparent',
                ].join(' ')}
                aria-hidden
              >
                <CheckIcon />
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-7 flex justify-between gap-3 max-[520px]:flex-col-reverse">
        <SetupButton
          onClick={goBack}
          loading={navTarget === 'back'}
          disabled={navTarget !== null}
        >
          Geri
        </SetupButton>
        <SetupButton
          variant="primary"
          grow
          disabled={!draft.primaryCountry || navTarget !== null}
          loading={navTarget === 'next'}
          loadingLabel="Devam ediliyor…"
          onClick={goNext}
        >
          Devam
        </SetupButton>
      </div>
    </div>
  );
}
