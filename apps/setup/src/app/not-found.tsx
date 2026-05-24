import Link from 'next/link';
import { setupButtonClass } from '@/components/SetupButton';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-stretch justify-center p-6 max-[880px]:p-0">
      <div className="w-full max-w-[460px] rounded-xl border border-line bg-white px-8 py-9 text-center shadow">
        <span className="inline-flex items-center gap-[7px] rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
          404
        </span>
        <h1 className="mb-1.5 mt-4 text-2xl font-semibold leading-[1.2] tracking-[-0.02em]">
          Sayfa bulunamadı
        </h1>
        <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
          Aradığınız sayfa bulunamadı. Platform kurulum sihirbazına
          dönebilirsiniz.
        </p>
        <div className="mt-6">
          <Link
            href="/setup"
            className={setupButtonClass({ variant: 'primary' })}
          >
            Kuruluma dön
          </Link>
        </div>
      </div>
    </div>
  );
}
