import Link from 'next/link';

export default function TenantNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 p-6 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-primary-700">404</p>
      <h1 className="mt-3 text-[26px] font-bold tracking-[-0.02em] text-ink-900">
        Sayfa bulunamadı
      </h1>
      <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-500">
        Aradığınız tenant sayfası taşınmış veya hiç var olmamış olabilir.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-[14px] font-semibold text-white transition hover:bg-primary-600"
      >
        Tenant girişine dön
      </Link>
    </div>
  );
}
