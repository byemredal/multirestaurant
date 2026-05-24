'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readAuthSession } from '@/lib/storage/auth-session';
import {
  fetchActiveLegalDocuments,
  fetchCustomerConsentHistory,
  recordCustomerConsent,
  type ConsentHistoryEntry,
  type LegalDocumentBundle,
} from '@/lib/legal/legal-consent-client';

type ViewState = 'loading' | 'unauthenticated' | 'ready' | 'error';

export default function CustomerLegalPage() {
  const [state, setState] = useState<ViewState>('loading');
  const [docs, setDocs] = useState<LegalDocumentBundle[]>([]);
  const [history, setHistory] = useState<ConsentHistoryEntry[]>([]);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const session = readAuthSession();
    if (!session) {
      setState('unauthenticated');
      return;
    }
    try {
      const [d, h] = await Promise.all([
        fetchActiveLegalDocuments('customer', 'tr'),
        fetchCustomerConsentHistory(session.accessToken),
      ]);
      setDocs(d);
      setHistory(h);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veriler yüklenemedi.');
      setState('error');
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const revoke = async (versionId: string) => {
    const session = readAuthSession();
    if (!session) return;
    if (!window.confirm('Bu onayı geri almak istediğinize emin misiniz?')) return;
    try {
      setBusyVersionId(versionId);
      setError(null);
      await recordCustomerConsent({
        token: session.accessToken,
        channel: 'web',
        entries: [{ documentVersionId: versionId, action: 'revoked', contextRef: '/me/legal' }],
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geri alınamadı.');
    } finally {
      setBusyVersionId(null);
    }
  };

  if (state === 'loading') {
    return (
      <main className="mx-auto max-w-[860px] px-5 py-10 text-[14px] text-[#71717a]">
        Yükleniyor…
      </main>
    );
  }

  if (state === 'unauthenticated') {
    return (
      <main className="mx-auto max-w-[860px] px-5 py-10">
        <h1 className="text-[20px] font-bold text-[#18181b]">Yasal Belgeler</h1>
        <p className="mt-3 text-[14px] text-[#71717a]">
          Yasal onaylarınızı görmek için{' '}
          <Link href="/login?returnTo=/me/legal" className="text-[#084799] underline">
            giriş yapın
          </Link>
          .
        </p>
      </main>
    );
  }

  // Latest grant per documentVersionId (history is sorted DESC).
  const latestPerVersion = new Map<string, ConsentHistoryEntry>();
  for (const entry of history) {
    if (!latestPerVersion.has(entry.documentVersionId)) {
      latestPerVersion.set(entry.documentVersionId, entry);
    }
  }

  return (
    <main className="mx-auto max-w-[860px] px-5 py-10">
      <h1 className="text-[20px] font-bold text-[#18181b]">Yasal Belgeler</h1>
      <p className="mt-2 text-[14px] text-[#71717a]">
        Aktif platform yasal belgeleriniz ve onay geçmişiniz.
      </p>

      {error && (
        <div className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-[16px] font-bold text-[#18181b]">Aktif Belgeler</h2>
        <div className="mt-3 space-y-3">
          {docs.length === 0 ? (
            <p className="text-[13px] text-[#71717a]">
              Henüz yayında bir doküman yok.
            </p>
          ) : (
            docs.map((doc) => {
              const version = doc.currentVersion;
              if (!version) return null;
              const accepted = latestPerVersion.get(version.id);
              const acceptedActive = accepted?.action === 'granted';
              return (
                <article
                  key={doc.id}
                  className="rounded-[14px] border border-[#e4e4e7] bg-white p-4"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#18181b]">
                        {version.title}
                      </h3>
                      <p className="text-[12px] text-[#71717a]">
                        {doc.code} · sürüm {version.versionLabel} · {version.locale}
                      </p>
                    </div>
                    <span
                      className={
                        acceptedActive
                          ? 'rounded-full bg-[#dcfce7] px-3 py-1 text-[11px] font-semibold text-[#166534]'
                          : 'rounded-full bg-[#f4f4f5] px-3 py-1 text-[11px] font-semibold text-[#71717a]'
                      }
                    >
                      {acceptedActive ? 'Onaylı' : 'Onay bekliyor'}
                    </span>
                  </header>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[12px] text-[#084799]">
                      İçeriği göster
                    </summary>
                    <pre className="mt-3 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-[10px] bg-[#f9fafb] p-3 text-[12px] text-[#3f3f46]">
                      {version.body}
                    </pre>
                  </details>
                  {acceptedActive && (
                    <div className="mt-3">
                      <button
                        onClick={() => revoke(version.id)}
                        disabled={busyVersionId === version.id}
                        className="rounded-[10px] border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyVersionId === version.id ? 'İşleniyor…' : 'Onayı geri al'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[16px] font-bold text-[#18181b]">Onay Geçmişi</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#71717a]">Henüz kayıt yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.slice(0, 50).map((entry) => (
              <li
                key={entry.id}
                className="rounded-[10px] border border-[#f4f4f5] bg-white px-4 py-3 text-[12px] text-[#3f3f46]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {entry.action === 'granted'
                      ? 'Onaylandı'
                      : entry.action === 'revoked'
                        ? 'Geri alındı'
                        : 'Yenilendi'}
                  </span>
                  <span className="text-[#71717a]">
                    {new Date(entry.acceptedAt).toLocaleString('tr-TR')}
                  </span>
                </div>
                <p className="mt-1 text-[#71717a]">
                  channel: {entry.channel}
                  {entry.contextRef ? ` · ${entry.contextRef}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center">
        <Link href="/" className="text-[13px] text-[#084799] underline">
          Ana sayfaya dön
        </Link>
      </p>
    </main>
  );
}
