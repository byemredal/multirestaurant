'use client';

import { useMemo } from 'react';
import { Card } from '@lieferzonen/ui';
import type { TenantOnboardingResolvedSession, TenantOnboardingWorkspace } from '@/lib/tenant-onboarding-client';
import { getSubmittedCopy } from './onboarding-country-pack';

type SubmittedStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onNavigate?: (url: string) => void;
};

type LifecycleCopy = {
  badge: string;
  badgeTone: 'success' | 'warning' | 'danger';
  iconLabel: string;
  iconTone: 'success' | 'warning' | 'danger';
  title: string;
  body: string;
  note: string;
  primaryAction?: { label: string; href: string };
};

function getLifecycleCopy(status: string, fallback: ReturnType<typeof getSubmittedCopy>): LifecycleCopy {
  switch (status) {
    case 'approved':
    case 'active':
      return {
        badge: 'Onaylandı',
        badgeTone: 'success',
        iconLabel: 'OK',
        iconTone: 'success',
        title: 'Başvurunuz onaylandı',
        body:
          'Hesabınız aktif. Kayıt e-postanıza şifre belirleme bağlantısı gönderdik — ' +
          'bağlantıya tıklayarak şifrenizi oluşturup tenant paneline geçebilirsiniz.',
        note:
          'Bağlantı 24 saat geçerlidir. E-postanız ulaşmadıysa spam/junk klasörünü kontrol edin, ' +
          'ardından destek ekibimizle iletişime geçin.',
        primaryAction: { label: 'Giriş ekranına git', href: '/login' },
      };
    case 'rejected':
      return {
        badge: 'Reddedildi',
        badgeTone: 'danger',
        iconLabel: '!',
        iconTone: 'danger',
        title: 'Başvurunuz onaylanmadı',
        body: 'Başvurunuz şu an için onaylanmadı. Daha fazla bilgi için destek ekibimizle iletişime geçin.',
        note: 'Destek için tenant başvurunuzu yaptığınız e-posta adresine yanıt yazabilirsiniz.',
      };
    case 'suspended':
      return {
        badge: 'Beklemeye alındı',
        badgeTone: 'warning',
        iconLabel: '!',
        iconTone: 'warning',
        title: 'Başvurunuz duraklatıldı',
        body: 'Başvurunuz geçici olarak duraklatıldı. Durum güncellendiğinde sizi bilgilendireceğiz.',
        note: 'Detaylar için destek ekibimizle iletişime geçebilirsiniz.',
      };
    case 'submitted':
    case 'under_review':
      return {
        badge: status === 'under_review' ? 'İnceleniyor' : 'Onay bekliyor',
        badgeTone: 'warning',
        iconLabel: '...',
        iconTone: 'warning',
        title: fallback.title,
        body: fallback.body,
        note: fallback.note,
      };
    default:
      return {
        badge: 'Gönderildi',
        badgeTone: 'success',
        iconLabel: 'OK',
        iconTone: 'success',
        title: fallback.title,
        body: fallback.body,
        note: fallback.note,
      };
  }
}

const BADGE_TONES = {
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
} as const;

const ICON_TONES = {
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
} as const;

export function SubmittedStep({ resolvedSession, workspace, onNavigate }: SubmittedStepProps) {
  const fallbackCopy = useMemo(() => getSubmittedCopy(), []);
  const status = resolvedSession?.status ?? workspace.application.status;
  const copy = useMemo(() => getLifecycleCopy(status, fallbackCopy), [status, fallbackCopy]);

  const statusLabel = copy.badge;

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <div className="mx-auto max-w-[560px] py-8 text-center sm:py-14">
        <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${BADGE_TONES[copy.badgeTone]}`}>
          {statusLabel}
        </span>
        <div
          className={`mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-[8px] text-[26px] font-bold ${ICON_TONES[copy.iconTone]}`}
        >
          {copy.iconLabel}
        </div>
        <h2 className="mt-6 text-[28px] font-bold text-ink-900 sm:text-[32px]">{copy.title}</h2>
        <p className="mx-auto mt-3 max-w-[470px] text-[15px] leading-7 text-ink-600">{copy.body}</p>
        <p className="mx-auto mt-5 max-w-[470px] rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-3 text-[13px] leading-6 text-ink-600">
          {copy.note}
        </p>

        {workspace.revisionRequests.length > 0 ? (
          <div className="mx-auto mt-5 max-w-[470px] rounded-[8px] border border-warning-100 bg-warning-50 px-4 py-3 text-left">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-warning-700">
              Inceleme notları
            </p>
            <ul className="mt-2 space-y-1.5">
              {workspace.revisionRequests.map((note, index) => (
                <li key={index} className="text-[13px] leading-relaxed text-warning-800">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {copy.primaryAction ? (
          <div className="mt-7">
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate(copy.primaryAction!.href);
                  return;
                }
                if (typeof window !== 'undefined') {
                  window.location.href = copy.primaryAction!.href;
                }
              }}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              {copy.primaryAction.label}
            </button>
          </div>
        ) : null}

        <dl className="mx-auto mt-8 grid max-w-[430px] gap-3 rounded-[8px] border border-ink-100 p-4 text-left text-[13px] sm:grid-cols-2">
          <dt className="text-ink-500">Başvuru durumu</dt>
          <dd className="font-semibold text-ink-800">{statusLabel}</dd>
          <dt className="text-ink-500">Gönderilme tarihi</dt>
          <dd className="font-semibold text-ink-800">
            {workspace.application.submittedAt
              ? new Date(workspace.application.submittedAt).toLocaleString('tr-TR')
              : 'Güncelleme bekleniyor'}
          </dd>
          {workspace.application.approvedAt ? (
            <>
              <dt className="text-ink-500">Onay tarihi</dt>
              <dd className="font-semibold text-ink-800">
                {new Date(workspace.application.approvedAt).toLocaleString('tr-TR')}
              </dd>
            </>
          ) : null}
        </dl>
      </div>
    </Card>
  );
}
