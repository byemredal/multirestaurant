'use client';

import { useState } from 'react';
import type { StaffInvitePayload } from '@/lib/tenant-staff-client';

/**
 * One-shot reveal of the raw invite token + accept URL. The backend returns
 * the raw value exactly once at invite time and never persists it — this
 * card is what the tenant owner copies and hands to the new hire.
 *
 * The component intentionally:
 *   • does NOT pre-select the token / URL on mount (no implicit clipboard
 *     writes; the user explicitly clicks Copy).
 *   • shows a clear warning that the token cannot be recovered if missed.
 *   • does NOT show the token hash or any internal detail.
 */
export function InviteTokenResult({
  invite,
  baseUrl,
}: {
  invite: StaffInvitePayload;
  baseUrl: string;
}) {
  const acceptUrl = `${baseUrl}${invite.acceptUrl}`;
  const [copied, setCopied] = useState<'url' | 'token' | null>(null);

  async function copy(kind: 'url' | 'token', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2200);
    } catch {
      // Browsers without clipboard API: silently no-op. The text is still
      // visible/selectable so the user can copy manually.
    }
  }

  return (
    <section className="rounded-[18px] border border-amber-200 bg-amber-50 p-5">
      <h3 className="text-[14px] font-semibold text-amber-900">
        Davet bağlantısı yalnızca bir kez gösterilir
      </h3>
      <p className="mt-1 text-[12.5px] leading-5 text-amber-800">
        Bu bağlantıyı kapatırsanız tekrar göremezsiniz. Yeni davet üretmek için
        personel detayından <em>Daveti yeniden gönder</em> seçeneğini kullanın.
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-[12px] border border-amber-200 bg-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
            Davet bağlantısı
          </div>
          <div className="mt-1.5 flex items-start justify-between gap-2">
            <code className="block min-w-0 flex-1 break-all text-[12px] text-slate-800">
              {acceptUrl}
            </code>
            <button
              type="button"
              onClick={() => copy('url', acceptUrl)}
              className="shrink-0 rounded-[8px] border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-50"
            >
              {copied === 'url' ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </div>

        <details className="rounded-[12px] border border-amber-200 bg-white p-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-amber-800">
            Ham token (yalnızca debug)
          </summary>
          <div className="mt-2 flex items-start justify-between gap-2">
            <code className="block min-w-0 flex-1 break-all text-[11.5px] text-slate-700">
              {invite.token}
            </code>
            <button
              type="button"
              onClick={() => copy('token', invite.token)}
              className="shrink-0 rounded-[8px] border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800"
            >
              {copied === 'token' ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </details>

        <div className="text-[11.5px] text-amber-800">
          Geçerlilik bitişi: {new Date(invite.expiresAt).toLocaleString('tr-TR')}
        </div>
      </div>
    </section>
  );
}
