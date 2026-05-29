'use client';

import { useEffect, useState } from 'react';
import { cn } from '@lieferzonen/ui';
import { apiBaseUrl } from '@/lib/tenant-client';

type LegalDocBundle = {
  typeCode: string | null;
  currentVersion: { versionLabel: string; title: string } | null;
};

const REQUIRED_DOCS: Array<{ code: string; label: string }> = [
  { code: 'distance_sales_contract', label: 'Mesafeli satış sözleşmesi' },
  { code: 'pre_information_form', label: 'Ön bilgilendirme formu' },
];

export default function SettingsLegalPanel() {
  const [docs, setDocs] = useState<LegalDocBundle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/public/legal/documents/active?audience=customer&locale=tr`,
        );
        if (!res.ok) throw new Error('legal_docs_fetch_failed');
        const data = (await res.json()) as { documents?: LegalDocBundle[] } | LegalDocBundle[];
        if (cancelled) return;
        setDocs(Array.isArray(data) ? data : (data.documents ?? []));
      } catch {
        if (!cancelled) setError('Yasal belge durumu yüklenemedi.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusFor = (code: string) =>
    docs?.find((doc) => doc.typeCode === code && doc.currentVersion) ?? null;

  const allReady =
    docs !== null && REQUIRED_DOCS.every((doc) => Boolean(statusFor(doc.code)));

  return (
    <div className="grid gap-4">
      <section className="rounded-[18px] border border-[#ece2d2] bg-white p-5">
        <h3 className="text-[15px] font-bold text-[#1c1917]">Sipariş için yasal dokümanlar</h3>
        <p className="mt-1 text-[13px] leading-6 text-[#78716c]">
          Müşterilerin sipariş verebilmesi için mesafeli satış sözleşmesi ve ön bilgilendirme
          formunun yayında olması gerekir. Bu dokümanlar platform yöneticisi tarafından admin
          panelinden yayınlanır.
        </p>

        {error ? (
          <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : docs === null ? (
          <p className="mt-4 text-[13px] text-[#78716c]">Durum yükleniyor…</p>
        ) : (
          <>
            <div className="mt-4 grid gap-2">
              {REQUIRED_DOCS.map((doc) => {
                const published = statusFor(doc.code);
                return (
                  <div
                    key={doc.code}
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-[#ece2d2] bg-[#fbf7f1] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-[#1c1917]">
                        {published?.currentVersion?.title ?? doc.label}
                      </div>
                      {published?.currentVersion ? (
                        <div className="text-[11.5px] text-[#a8a29e]">
                          Yayında · sürüm {published.currentVersion.versionLabel}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        published
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {published ? 'Yayında' : 'Eksik'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className={cn(
                'mt-4 rounded-[14px] px-4 py-3 text-[13px]',
                allReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
              )}
            >
              {allReady
                ? 'Tüm zorunlu yasal dokümanlar yayında. Checkout siparişe açık.'
                : 'Eksik dokümanlar yayınlanana kadar müşteriler bu vitrinde sipariş veremez. Lütfen platform yöneticisiyle iletişime geçin.'}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
