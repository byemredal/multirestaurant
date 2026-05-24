'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readAuthSession } from '@/lib/storage/auth-session';
import {
  fetchCustomerMarketingConsents,
  upsertCustomerMarketingConsents,
  type MarketingConsentChannel,
  type MarketingConsentSnapshot,
} from '@/lib/legal/legal-consent-client';

const CHANNEL_LABELS: Record<MarketingConsentChannel, string> = {
  email: 'E-posta',
  sms: 'SMS',
  push: 'Push bildirim',
  call: 'Arama',
};

const CHANNEL_DESCRIPTIONS: Record<MarketingConsentChannel, string> = {
  email: 'Kampanya ve duyurular e-posta yoluyla iletilir.',
  sms: 'Restoran açılışları ve indirim bildirimleri SMS ile gönderilir.',
  push: 'Uygulama açıkken bildirim olarak gösterilir.',
  call: 'Yeni özellikler için telefonla aranabilirsiniz.',
};

const ALL_CHANNELS: MarketingConsentChannel[] = ['email', 'sms', 'push', 'call'];

export default function CustomerMarketingPage() {
  const [snapshots, setSnapshots] = useState<MarketingConsentSnapshot[] | null>(null);
  const [busyChannel, setBusyChannel] = useState<MarketingConsentChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauth, setUnauth] = useState(false);

  const reload = async () => {
    const session = readAuthSession();
    if (!session) {
      setUnauth(true);
      return;
    }
    try {
      const list = await fetchCustomerMarketingConsents(session.accessToken);
      setSnapshots(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi.');
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const toggle = async (channel: MarketingConsentChannel, currentGranted: boolean) => {
    const session = readAuthSession();
    if (!session) return;
    try {
      setBusyChannel(channel);
      setError(null);
      await upsertCustomerMarketingConsents({
        token: session.accessToken,
        entries: [
          {
            channel,
            action: currentGranted ? 'revoked' : 'granted',
            source: 'settings-page',
          },
        ],
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setBusyChannel(null);
    }
  };

  if (unauth) {
    return (
      <main className="mx-auto max-w-[720px] px-5 py-10">
        <h1 className="text-[20px] font-bold text-[#18181b]">Pazarlama Tercihleri</h1>
        <p className="mt-3 text-[14px] text-[#71717a]">
          Tercihlerinizi görmek için{' '}
          <Link href="/login?returnTo=/me/marketing" className="text-[#084799] underline">
            giriş yapın
          </Link>
          .
        </p>
      </main>
    );
  }

  const indexed = new Map<MarketingConsentChannel, MarketingConsentSnapshot>();
  for (const s of snapshots ?? []) indexed.set(s.channel, s);

  return (
    <main className="mx-auto max-w-[720px] px-5 py-10">
      <h1 className="text-[20px] font-bold text-[#18181b]">Pazarlama Tercihleri</h1>
      <p className="mt-2 text-[14px] text-[#71717a]">
        Hangi kanallar üzerinden iletişim almak istediğinizi yönetin. Tüm
        değişiklikler kalıcı olarak kaydedilir (KVKK uyumlu).
      </p>

      {error && (
        <div className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {snapshots === null ? (
        <p className="mt-6 text-[13px] text-[#71717a]">Yükleniyor…</p>
      ) : (
        <div className="mt-6 space-y-3">
          {ALL_CHANNELS.map((channel) => {
            const snapshot = indexed.get(channel);
            const granted = snapshot?.isGranted ?? false;
            const busy = busyChannel === channel;
            return (
              <div
                key={channel}
                className="flex items-start justify-between gap-4 rounded-[14px] border border-[#e4e4e7] bg-white p-4"
              >
                <div>
                  <p className="text-[14px] font-semibold text-[#18181b]">
                    {CHANNEL_LABELS[channel]}
                  </p>
                  <p className="mt-1 text-[12px] text-[#71717a]">
                    {CHANNEL_DESCRIPTIONS[channel]}
                  </p>
                  {snapshot?.lastChangedAt && (
                    <p className="mt-2 text-[11px] text-[#a1a1aa]">
                      Son güncelleme:{' '}
                      {new Date(snapshot.lastChangedAt).toLocaleString('tr-TR')}
                      {snapshot.source ? ` · ${snapshot.source}` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggle(channel, granted)}
                  disabled={busy}
                  className={
                    granted
                      ? 'rounded-full bg-[#084799] px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50'
                      : 'rounded-full border border-[#e4e4e7] bg-white px-4 py-2 text-[12px] font-semibold text-[#3f3f46] transition hover:border-[#084799] hover:text-[#084799] disabled:opacity-50'
                  }
                >
                  {busy ? 'Kaydediliyor…' : granted ? 'Açık' : 'Kapalı'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-center">
        <Link href="/" className="text-[13px] text-[#084799] underline">
          Ana sayfaya dön
        </Link>
      </p>
    </main>
  );
}
