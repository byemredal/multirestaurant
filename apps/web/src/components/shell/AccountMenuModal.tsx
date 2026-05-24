'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { reportTelemetry } from '@/lib/telemetry';
import type { StoredAuthSession } from '@/lib/storage/auth-session';
import { writeAuthSession } from '@/lib/storage/auth-session';
import { apiBaseUrl } from '@/lib/config';
import { Button, Modal } from '@lieferzonen/ui';

type MenuView =
  | 'overview'
  | 'orders'
  | 'rewards'
  | 'stampcards'
  | 'gift-cards'
  | 'support'
  | 'settings';

type Props = {
  authSession: StoredAuthSession | null;
  onClose: () => void;
  onLogout: () => Promise<void>;
  onOpenAuth: (mode: 'login' | 'signup') => void;
};

type ApiState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: unknown };

/* ── Icons ────────────────────────────────────────────────────────────── */

function Icon({
  children,
  className = 'h-[18px] w-[18px]',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const CloseIcon = () => <Icon><path d="M6 6l12 12" /><path d="M18 6l-12 12" /></Icon>;
const HomeIcon = () => <Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Icon>;
const OrdersIcon = () => <Icon><path d="M8 7h8l1 11H7L8 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></Icon>;
const GiftIcon = () => <Icon><path d="M20 12v8H4v-8" /><path d="M2 7h20v5H2z" /><path d="M12 7v13" /><path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5V7Z" /><path d="M12 7h3.5A2.5 2.5 0 1 0 13 4.5V7Z" /></Icon>;
const TicketIcon = () => <Icon><path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 1 0-4V4H4v4Z" /><path d="M12 4v12" /></Icon>;
const HelpIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.9.9-1.8 1.5-1.8 3" /><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" /></Icon>;
const SettingsIcon = () => <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1c.5.5 1.2.7 1.8.3.6-.2 1-.8 1-1.5V3a2 2 0 0 1 4 0v.1c0 .7.4 1.3 1 1.5.6.4 1.3.2 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1c-.4.5-.5 1.2-.3 1.8.2.6.8 1 1.5 1H21a2 2 0 0 1 0 4h-.1c-.7 0-1.3.4-1.5 1Z" /></Icon>;
const PowerIcon = () => <Icon><path d="M12 2v10" /><path d="M6.2 5.6a8 8 0 1 0 11.6 0" /></Icon>;
const ChevronRight = () => <Icon className="h-4 w-4"><path d="M9 6l6 6-6 6" /></Icon>;
const BackIcon = () => <Icon><path d="M15 18l-6-6 6-6" /></Icon>;
const CheckIcon = () => <Icon className="h-3.5 w-3.5"><path d="m5 12.5 4.5 4.5L19 7" /></Icon>;

/* ── Nav config ───────────────────────────────────────────────────────── */

const NAV_ITEMS: Array<{
  id: MenuView;
  label: string;
  group: 'main' | 'meta';
  icon: () => React.ReactElement;
}> = [
    { id: 'overview', label: 'Genel bakış', group: 'main', icon: HomeIcon },
    { id: 'orders', label: 'Siparişler', group: 'main', icon: OrdersIcon },
    { id: 'rewards', label: 'Ödüller', group: 'main', icon: GiftIcon },
    { id: 'stampcards', label: 'Damga kartları', group: 'main', icon: TicketIcon },
    { id: 'gift-cards', label: 'Hediye çekleri', group: 'main', icon: GiftIcon },
    { id: 'support', label: 'Yardım', group: 'meta', icon: HelpIcon },
    { id: 'settings', label: 'Ayarlar', group: 'meta', icon: SettingsIcon },
  ];

const MAIN_NAV = NAV_ITEMS.filter((n) => n.group === 'main');
const META_NAV = NAV_ITEMS.filter((n) => n.group === 'meta');
const TITLE_BY_VIEW = Object.fromEntries(NAV_ITEMS.map((n) => [n.id, n.label])) as Record<
  MenuView,
  string
>;

/* ── Component ────────────────────────────────────────────────────────── */

export default function AccountMenuModal({
  authSession,
  onClose,
  onLogout,
  onOpenAuth,
}: Props) {
  const [view, setView] = useState<MenuView>('overview');
  const [apiState, setApiState] = useState<ApiState>({ state: 'idle' });
  const [navOpenMobile, setNavOpenMobile] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(authSession?.account.id);
  const userName = authSession
    ? `${authSession.account.firstName} ${authSession.account.lastName}`.trim()
    : null;
  const initials = useMemo(() => {
    if (!userName) return 'LZ';
    const parts = userName.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'LZ';
  }, [userName]);

  /* Esc + click-outside */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* Fetch per-tab data */
  useEffect(() => {
    if (view === 'overview' || view === 'gift-cards' || view === 'settings') {
      setApiState({ state: 'idle' });
      return;
    }

    if (!signedIn && ['orders', 'rewards', 'stampcards'].includes(view)) {
      setApiState({
        state: 'error',
        message: 'Bu bölümü görmek için lütfen giriş yap.',
      });
      return;
    }

    if (!signedIn) {
      setApiState({ state: 'ready', data: null });
      return;
    }

    const endpointMap: Partial<Record<MenuView, string>> = {
      orders: `${apiBaseUrl}/orders?scope=all`,
      rewards: `${apiBaseUrl}/auth/rewards`,
      stampcards: `${apiBaseUrl}/auth/stampcards`,
      support: `${apiBaseUrl}/auth/help`,
    };
    const endpoint = endpointMap[view];
    if (!endpoint) {
      setApiState({ state: 'ready', data: null });
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        setApiState({ state: 'loading' });
        const response = await fetch(endpoint, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${authSession?.accessToken}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`request_failed_${view}`);
        const payload = (await response.json()) as unknown;
        setApiState({ state: 'ready', data: payload });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setApiState({
            state: 'error',
            message: 'Bu bölüm şu an yüklenemiyor.',
          });
          void reportTelemetry({
            type: 'account_modal_fetch_error',
            payload: { view },
          });
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [authSession?.accessToken, signedIn, view]);

  const selectTab = (next: MenuView) => {
    if (['orders', 'rewards', 'stampcards'].includes(next) && !signedIn) {
      onOpenAuth('login');
      return;
    }
    setView(next);
    setNavOpenMobile(false);
  };

  return (
    <Modal
      title={TITLE_BY_VIEW[view]}
      open={true}
      onClose={onClose}
      size='2xl'
    >
      <div
        ref={dialogRef}
        className="flex w-full max-w-[1040px] flex-col overflow-hidden rounded-3xl bg-white shadow-pop sm:flex-row sm:h-[700px]"
      >
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className={`flex w-full shrink-0 flex-col border-b border-ink-100 bg-ink-50 sm:w-[260px] sm:border-b-0 sm:border-r ${navOpenMobile ? 'block' : 'hidden sm:flex'
            }`}
        >
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-card">
              <span className="text-[14px] font-bold">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-ink-900">
                {signedIn ? userName : 'Misafir'}
              </p>
              <p className="truncate text-[11.5px] text-ink-500">
                {signedIn ? authSession?.account.email : 'Giriş yaparak avantajlardan yararlan'}
              </p>
            </div>
          </div>

          <div className="border-t border-ink-100" />

          <nav aria-label="Hesap menüsü" className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
              Hesap
            </p>
            <ul className="mt-2 grid gap-0.5">
              {MAIN_NAV.map((item) => (
                <li key={item.id}>
                  <NavButton item={item} active={view === item.id} onClick={() => selectTab(item.id)} />
                </li>
              ))}
            </ul>

            <p className="mt-5 px-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
              Diğer
            </p>
            <ul className="mt-2 grid gap-0.5">
              {META_NAV.map((item) => (
                <li key={item.id}>
                  <NavButton item={item} active={view === item.id} onClick={() => selectTab(item.id)} />
                </li>
              ))}
            </ul>
          </nav>

          {signedIn ? (
            <Button
              type="button"
              onClick={() => void onLogout()}
              shimmer={true}
              variant='danger'
              className='mb-5 mx-6'
            >
              <span className='flex flex-row justify-content items-center gap-4'><PowerIcon />Çıkış yap</span>
            </Button>
          ) : null}
        </aside>

        {/* ── Content area ─────────────────────────────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col">


          {/* Animated view container */}
          <div className="relative flex-1 overflow-y-auto">
            <div
              key={view}
              className="animate-modal-view px-5 py-6 sm:px-7"
            >
              {view === 'overview' ? (
                <OverviewPanel
                  signedIn={signedIn}
                  authSession={authSession}
                  onOpenAuth={onOpenAuth}
                  onSelectTab={selectTab}
                />
              ) : view === 'gift-cards' ? (
                <GiftCardsPanel />
              ) : view === 'settings' ? (
                <SettingsPanel authSession={authSession} signedIn={signedIn} onOpenAuth={onOpenAuth} />
              ) : (
                <DataPanel view={view} apiState={apiState} />
              )}
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}

/* ── Nav button ───────────────────────────────────────────────────────── */

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { id: MenuView; label: string; icon: () => React.ReactElement };
  active: boolean;
  onClick: () => void;
}) {
  const IconCmp = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition ${active
          ? 'bg-white text-ink-900 shadow-card'
          : 'text-ink-700 hover:bg-white/60'
        }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${active
            ? 'bg-primary-50 text-primary-700'
            : 'bg-ink-100 text-ink-600 group-hover:bg-white group-hover:text-ink-800'
          }`}
      >
        <IconCmp />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      <span
        aria-hidden
        className={`text-ink-400 transition ${active ? 'opacity-100 text-primary-700' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <ChevronRight />
      </span>
    </button>
  );
}

/* ── Overview panel ───────────────────────────────────────────────────── */

function OverviewPanel({
  signedIn,
  authSession,
  onOpenAuth,
  onSelectTab,
}: {
  signedIn: boolean;
  authSession: StoredAuthSession | null;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onSelectTab: (view: MenuView) => void;
}) {
  if (!signedIn) {
    return (
      <div className="grid gap-5">
        <div className="rounded-3xl border border-primary-100 bg-primary-50/60 p-6 sm:p-7">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-primary-700">
            Hoş geldin
          </p>
          <h3 className="mt-2 font-italiana text-[28px] leading-tight tracking-[-0.01em] text-ink-900 sm:text-[34px]">
            Hesap aç, deneyimi yükselt.
          </h3>
          <p className="mt-2 max-w-[440px] text-[14px] leading-relaxed text-ink-600">
            Sipariş geçmişi, favori restoranlar, ödüller ve damga kartları — hepsi tek panelden yönetilebilir.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[13.5px] font-semibold text-white transition hover:bg-primary-600"
            >
              Giriş yap
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="inline-flex h-11 items-center justify-center rounded-full border border-ink-200 bg-white px-5 text-[13.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
            >
              Hesap oluştur
            </button>
          </div>
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {[
            ['Sipariş geçmişi', 'Her şey tek bir akışta'],
            ['Ödül puanları', 'Sipariş başı kazan'],
            ['Damga kartları', 'Belli partnerlerde ücretsiz ürün'],
            ['Hızlı checkout', 'Adresleri kaydet, sonra tek tıkla bitir'],
          ].map(([t, d]) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                <CheckIcon />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink-900">{t}</p>
                <p className="text-[12px] text-ink-500">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-ink-100 bg-gradient-to-br from-primary-50 via-white to-white p-6 sm:p-7">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-primary-700">
          Hoş geldin
        </p>
        <h3 className="mt-2 font-italiana text-[28px] leading-tight tracking-[-0.01em] text-ink-900 sm:text-[34px]">
          {authSession?.account.firstName ?? 'Gezgin'}, bugün ne yiyoruz?
        </h3>
        <p className="mt-2 max-w-[480px] text-[14px] leading-relaxed text-ink-600">
          Son siparişlerini tekrarla, ödüllerini hatırlat ya da yeni mekanlar keşfet.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { id: 'orders', label: 'Siparişler', desc: 'Geçmiş ve aktif', emoji: '📦' },
          { id: 'rewards', label: 'Ödüller', desc: 'Puan bakiyen', emoji: '🎁' },
          { id: 'stampcards', label: 'Damga kartları', desc: 'İlerlemen', emoji: '🎫' },
        ].map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => onSelectTab(tile.id as MenuView)}
            className="flex h-full flex-col items-start rounded-2xl border border-ink-100 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card"
          >
            <span className="text-[24px] leading-none">{tile.emoji}</span>
            <p className="mt-3 text-[14px] font-semibold text-ink-900">{tile.label}</p>
            <p className="mt-0.5 text-[12px] text-ink-500">{tile.desc}</p>
            <span aria-hidden className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700">
              Aç →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Gift cards (static) ──────────────────────────────────────────────── */

function GiftCardsPanel() {
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-ink-100 bg-gradient-to-br from-warning-50 via-white to-white p-6 sm:p-7">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-secondary-600">
          Yakında
        </p>
        <h3 className="mt-2 font-italiana text-[28px] leading-tight tracking-[-0.01em] text-ink-900 sm:text-[34px]">
          Hediye yemek kredisi.
        </h3>
        <p className="mt-2 max-w-[480px] text-[14px] leading-relaxed text-ink-600">
          Arkadaşlarına, ekibinle dijital hediye çeki gönder. Kullanım kolay — link tıklanır, sepete eklenir.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-6 text-center text-[13.5px] text-ink-500">
        Bu özellik şu an aktif değil — listeye girmek ister misin?
      </div>
    </div>
  );
}

/* ── Data-driven panels ───────────────────────────────────────────────── */

function DataPanel({ view, apiState }: { view: MenuView; apiState: ApiState }) {
  if (apiState.state === 'idle' || apiState.state === 'loading') {
    return <PanelSkeleton />;
  }
  if (apiState.state === 'error') {
    return (
      <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-[13.5px] text-danger-700">
        {apiState.message}
      </div>
    );
  }

  if (view === 'orders') return <OrdersView data={apiState.data} />;
  if (view === 'rewards') return <RewardsView data={apiState.data} />;
  if (view === 'stampcards') return <StampCardsView data={apiState.data} />;
  if (view === 'support') return <SupportView data={apiState.data} />;
  return null;
}

function PanelSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-ink-100" />
      ))}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
      <p className="text-[15px] font-semibold text-ink-900">{title}</p>
      <p className="mx-auto mt-1 max-w-[360px] text-[13px] text-ink-500">{desc}</p>
    </div>
  );
}

function OrdersView({ data }: { data: unknown }) {
  const payload = data as {
    orders?: Array<{
      id: string;
      storeName: string;
      status: string;
      totalAmount: number;
      currency: string;
    }>;
  };
  const orders = payload?.orders ?? [];

  if (orders.length === 0) {
    return <EmptyState title="Henüz sipariş yok" desc="İlk siparişinden sonra burada akacaklar." />;
  }

  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white px-4 py-3.5"
        >
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-ink-900">{order.storeName}</p>
            <p className="text-[12.5px] text-ink-500">{order.status}</p>
          </div>
          <p className="shrink-0 text-[14px] font-semibold text-ink-900">
            {order.totalAmount} {order.currency}
          </p>
        </div>
      ))}
    </div>
  );
}

function RewardsView({ data }: { data: unknown }) {
  const payload = data as {
    available: boolean;
    pointsBalance: number;
    message: string;
    history?: Array<{
      id: string;
      pointsDelta: number;
      balanceAfter: number;
      note?: string | null;
      createdAt: string;
    }>;
  };

  if (!payload?.available) {
    return <EmptyState title="Ödüller hazır değil" desc={payload?.message ?? 'Şu an ödüller henüz aktif değil.'} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-primary-100 bg-primary-50/60 p-5">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary-700">
            Bakiyen
          </p>
          <p className="mt-1 font-italiana text-[40px] leading-none text-ink-900">{payload.pointsBalance}</p>
          <p className="mt-1 text-[12px] text-ink-500">puan</p>
        </div>
        <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-card sm:flex">
          <GiftIcon />
        </div>
      </div>
      <div className="grid gap-3">
        {(payload.history ?? []).map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-ink-100 bg-white px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-semibold text-ink-900">
                {entry.note ?? 'Ödül aktivitesi'}
              </p>
              <p className="text-[14px] font-bold text-primary-700">+{entry.pointsDelta}</p>
            </div>
            <p className="mt-1 text-[12px] text-ink-500">
              {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StampCardsView({ data }: { data: unknown }) {
  const payload = data as {
    available: boolean;
    message: string;
    cards?: Array<{
      id: string;
      storeName: string;
      programName: string;
      rewardTitle: string;
      currentStamps: number;
      stampsRequired: number;
      isCompleted: boolean;
    }>;
  };

  if (!payload?.available) {
    return <EmptyState title="Aktif damga kartın yok" desc={payload?.message ?? 'Restoran damga programlarına henüz katılmadın.'} />;
  }

  return (
    <div className="grid gap-3">
      {(payload.cards ?? []).map((card) => {
        const pct = Math.min(100, (card.currentStamps / card.stampsRequired) * 100);
        return (
          <div key={card.id} className="rounded-2xl border border-ink-100 bg-white p-4">
            <p className="text-[14.5px] font-semibold text-ink-900">{card.storeName}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-500">{card.programName}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[12.5px] text-ink-500">
              <span>{card.currentStamps} / {card.stampsRequired} damga</span>
              <span>{card.isCompleted ? card.rewardTitle : 'Devam ediyor'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SupportView({ data }: { data: unknown }) {
  const payload = data as {
    email?: string;
    faq?: Array<{ id: string; title: string; description: string }>;
  };
  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-ink-100 bg-primary-50/60 px-4 py-3.5 text-[13.5px] text-ink-800">
        Destek e-postası: <span className="font-semibold">{payload?.email ?? 'destek@lieferzonen.com'}</span>
      </div>
      {(payload?.faq ?? []).map((item) => (
        <details
          key={item.id}
          className="group rounded-2xl border border-ink-100 bg-white px-4 py-3.5 open:border-primary-100 open:bg-primary-50/40"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-ink-900">
            {item.title}
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-[13px] text-ink-600 transition group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{item.description}</p>
        </details>
      ))}
    </div>
  );
}

/* ── Settings panel (profile editor) ──────────────────────────────────── */

function SettingsPanel({
  authSession,
  signedIn,
  onOpenAuth,
}: {
  authSession: StoredAuthSession | null;
  signedIn: boolean;
  onOpenAuth: (mode: 'login' | 'signup') => void;
}) {
  if (!signedIn) {
    return (
      <EmptyStateWithCta
        title="Ayarlar için giriş yap"
        desc="Profil bilgilerini güncellemek için önce hesabınla giriş yapmalısın."
        ctaLabel="Giriş yap"
        onCta={() => onOpenAuth('login')}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <ProfileForm authSession={authSession} />
      <PreferencesCard />
    </div>
  );
}

function EmptyStateWithCta({
  title,
  desc,
  ctaLabel,
  onCta,
}: {
  title: string;
  desc: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
      <p className="text-[16px] font-semibold text-ink-900">{title}</p>
      <p className="mx-auto mt-1 max-w-[360px] text-[13px] text-ink-500">{desc}</p>
      <button
        type="button"
        onClick={onCta}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[13.5px] font-semibold text-white transition hover:bg-primary-600"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
};

function ProfileForm({ authSession }: { authSession: StoredAuthSession | null }) {
  const [form, setForm] = useState<ProfileFormState>({
    firstName: authSession?.account.firstName ?? '',
    lastName: authSession?.account.lastName ?? '',
    email: authSession?.account.email ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initial = useMemo<ProfileFormState>(
    () => ({
      firstName: authSession?.account.firstName ?? '',
      lastName: authSession?.account.lastName ?? '',
      email: authSession?.account.email ?? '',
    }),
    [authSession],
  );

  const dirty =
    form.firstName !== initial.firstName ||
    form.lastName !== initial.lastName ||
    form.email !== initial.email;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving || !authSession) return;
    setSaving(true);
    setSaved(false);
    // Backend profil güncelleme endpoint'i henüz yok — değişiklikleri yerel
    // oturumda güncelliyoruz ve bilgilendiriyoruz.
    await new Promise((r) => setTimeout(r, 380));
    const nextSession: StoredAuthSession = {
      ...authSession,
      account: {
        ...authSession.account,
        firstName: form.firstName.trim() || authSession.account.firstName,
        lastName: form.lastName.trim() || authSession.account.lastName,
        email: form.email.trim() || authSession.account.email,
      },
    };
    writeAuthSession(nextSession);
    setSaving(false);
    setSaved(true);
    void reportTelemetry({
      type: 'profile_updated_local',
      payload: { accountId: authSession.account.id },
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-ink-100 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-primary-700">
            Profil
          </p>
          <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-ink-900">
            Hesap bilgileri
          </h3>
        </div>
        {saved && !dirty ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-[11.5px] font-semibold text-success-700">
            <CheckIcon />
            Kaydedildi
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Ad">
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => {
              setForm({ ...form, firstName: e.target.value });
              setSaved(false);
            }}
            className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Adın"
            autoComplete="given-name"
          />
        </Field>
        <Field label="Soyad">
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => {
              setForm({ ...form, lastName: e.target.value });
              setSaved(false);
            }}
            className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Soyadın"
            autoComplete="family-name"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="E-posta">
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                setSaved(false);
              }}
              className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ornek@eposta.com"
              autoComplete="email"
            />
          </Field>
        </div>
      </div>

      <p className="mt-3 text-[11.5px] text-ink-500">
        Sunucu tarafı profil güncellemesi yakında bağlanacak; şimdilik değişiklikler bu cihazdaki oturuma uygulanır.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-4">
        <button
          type="button"
          onClick={() => {
            setForm(initial);
            setSaved(false);
          }}
          disabled={!dirty || saving}
          className="inline-flex h-10 items-center justify-center rounded-full border border-ink-200 bg-white px-4 text-[13px] font-semibold text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
        >
          Geri al
        </button>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-[13px] font-semibold text-white transition hover:bg-primary-600 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="px-1 text-[12px] font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

function PreferencesCard() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [newsletter, setNewsletter] = useState(true);

  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-5 sm:p-6">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-primary-700">
        Tercihler
      </p>
      <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-ink-900">
        Görünüm & bildirimler
      </h3>

      <div className="mt-5 grid gap-5">
        <div>
          <p className="text-[13px] font-semibold text-ink-900">Tema</p>
          <p className="text-[12.5px] text-ink-500">Sistem temasını veya manuel modu seç.</p>
          <div className="mt-3 inline-flex rounded-full bg-ink-100 p-1">
            {(['system', 'light', 'dark'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setTheme(opt)}
                className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-[12.5px] font-semibold capitalize transition ${theme === opt
                    ? 'bg-white text-ink-900 shadow-card'
                    : 'text-ink-600 hover:text-ink-800'
                  }`}
              >
                {opt === 'system' ? 'Sistem' : opt === 'light' ? 'Açık' : 'Koyu'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink-900">E-posta bülteni</p>
            <p className="text-[12px] text-ink-500">
              Yeni restoran ve kampanya duyurularını al.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={newsletter}
            onClick={() => setNewsletter((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${newsletter ? 'bg-primary' : 'bg-ink-300'
              }`}
          >
            <span
              aria-hidden
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${newsletter ? 'left-5' : 'left-0.5'
                }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
