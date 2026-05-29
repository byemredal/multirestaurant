'use client';

import Link from 'next/link';
import { Button, cn } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';

function InfoRow({ label, value, tone }: { label: string; value: string; tone?: 'ok' }) {
  return (
    <div className="rounded-[14px] bg-[#f7fafd] px-4 py-3">
      <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a8a29e]">
        {label}
      </span>
      <div className={cn('mt-1 font-semibold', tone === 'ok' ? 'text-emerald-700' : 'text-[#1c1917]')}>
        {value}
      </div>
    </div>
  );
}

export default function SettingsGeneralPanel() {
  const { session } = useTenantAuth();
  const tenant = session?.tenant;

  return (
    <div className="grid gap-4">
      <section className="rounded-[18px] border border-[#ece2d2] bg-white p-5">
        <h3 className="text-[15px] font-bold text-[#1c1917]">Hesap bilgileri</h3>
        <p className="mt-0.5 text-[12.5px] text-[#78716c]">
          Oturumdaki tenant hesabının özeti.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <InfoRow label="Şirket" value={tenant?.companyName ?? '—'} />
          <InfoRow label="E-posta" value={tenant?.email ?? '—'} />
          <InfoRow
            label="Doğrulama"
            value={tenant?.verificationStatus ?? 'bilinmiyor'}
            tone={tenant?.verificationStatus === 'verified' ? 'ok' : undefined}
          />
          <InfoRow label="Onboarding" value={tenant?.onboardingStatus ?? 'bilinmiyor'} />
        </div>
      </section>

      <section className="rounded-[18px] border border-[#ece2d2] bg-white p-5">
        <h3 className="text-[15px] font-bold text-[#1c1917]">Restoran ayarları</h3>
        <p className="mt-1 text-[13px] leading-6 text-[#78716c]">
          Ödeme yöntemleri, teslimat bölgeleri, vergi ve fiş gibi restorana özel ayarlar artık
          her restoranın kendi yönetim alanında. <strong>Restoran &amp; Menü</strong> sayfasında
          ilgili restoranın satırındaki <strong>Ayarlar</strong> simgesine tıklayın.
        </p>
        <div className="mt-4">
          <Link href="/dashboard/studio">
            <Button variant="secondary">Restoran &amp; Menü&apos;ye git</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
