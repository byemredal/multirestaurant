'use client';

import { useEffect, useState } from 'react';
import { Button } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { getTenantOnboardingWorkspace } from '@/lib/tenant-onboarding-client';

type WaitingCopy = {
  badge: string;
  badgeTone: 'review' | 'danger';
  title: string;
  body: string;
};

function copyForStatus(onboardingStatus: string | null): WaitingCopy {
  switch (onboardingStatus) {
    case 'rejected':
      return {
        badge: 'Reddedildi',
        badgeTone: 'danger',
        title: 'Başvurunuz onaylanmadı',
        body: 'Başvurunuz şu an için onaylanmadı. Detaylar için tenant ekibimizle iletişime geçebilir veya bilgilerinizi güncelleyerek tekrar başvurabilirsiniz.',
      };
    case 'suspended':
      return {
        badge: 'Askıya alındı',
        badgeTone: 'danger',
        title: 'Hesabınız askıya alındı',
        body: 'Tenant hesabınız geçici olarak askıya alındı. Durum güncellendiğinde bu ekran otomatik olarak yenilenecek.',
      };
    case 'under_review':
      return {
        badge: 'İnceleniyor',
        badgeTone: 'review',
        title: 'Başvurunuz inceleniyor',
        body: 'Ekibimiz başvurunuzu değerlendiriyor. Onaylandığı anda bu ekran otomatik olarak panele yönlendirilecek — sayfayı yenilemenize gerek yok.',
      };
    case 'submitted':
    default:
      return {
        badge: 'Onay bekliyor',
        badgeTone: 'review',
        title: 'Başvurunuz alındı',
        body: 'Başvurunuz inceleme sırasına alındı. Onaylandığı anda bu ekran otomatik olarak panele yönlendirilecek — sayfayı yenilemenize gerek yok.',
      };
  }
}

/**
 * The PENDING_APPROVAL screen. It has no dedicated URL — it renders on the
 * `/tenant` entry route. When an admin approves the tenant, the SSE stream
 * flips the status to ACTIVE and `TenantGate` redirects to the dashboard.
 */
export function TenantWaitingScreen() {
  const { session, onboardingStatus, logout } = useTenantAuth();
  const copy = copyForStatus(onboardingStatus);

  // For a rejected / suspended application, surface the admin's tenant-visible
  // note (the reason) so the partner understands the decision.
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const showsReason = onboardingStatus === 'rejected' || onboardingStatus === 'suspended';

  useEffect(() => {
    if (!session || !showsReason) {
      setReviewNotes([]);
      return;
    }
    let cancelled = false;
    void getTenantOnboardingWorkspace(session)
      .then((workspace) => {
        if (!cancelled) {
          setReviewNotes(workspace.revisionRequests ?? []);
        }
      })
      .catch(() => {
        // Best-effort — the static copy already explains the state.
      });
    return () => {
      cancelled = true;
    };
  }, [session, showsReason]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-[460px] rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-card sm:p-10">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] ${
            copy.badgeTone === 'danger'
              ? 'bg-danger-50 text-danger-700'
              : 'bg-warning-50 text-warning-700'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              copy.badgeTone === 'danger' ? 'bg-danger-500' : 'bg-warning-500'
            }`}
          />
          {copy.badge}
        </span>

        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
          {copy.badgeTone === 'danger' ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#b42318" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          ) : (
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        <h1 className="mt-5 text-[24px] font-bold tracking-[-0.02em] text-ink-900">
          {copy.title}
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-500">{copy.body}</p>

        {showsReason && reviewNotes.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-left">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-danger-700">
              İnceleme notu
            </p>
            <ul className="mt-2 space-y-1.5">
              {reviewNotes.map((note, index) => (
                <li key={index} className="text-[13px] leading-relaxed text-danger-700">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3 text-[12.5px] text-ink-500">
          Bu ekran gerçek zamanlı bağlıdır. Durumunuz değiştiğinde otomatik
          olarak güncellenir.
        </div>

        <Button
          variant="secondary"
          className="mt-6 h-11 w-full rounded-full text-[14px]"
          onClick={() => {
            void logout();
          }}
        >
          Çıkış yap
        </Button>
      </div>
    </div>
  );
}
