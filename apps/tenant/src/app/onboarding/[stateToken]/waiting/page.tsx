'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@lieferzonen/ui';
import {
  getTenantOnboardingWorkspaceByStateToken,
  type TenantOnboardingApplicationStatus,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingResumeUrl } from '@/components/tenant/onboarding/onboarding-routing';
import {
  clearOnboardingStateToken,
} from '@/lib/storage/tenant-session';

type WaitingCopy = {
  badge: string;
  title: string;
  body: string;
  danger?: boolean;
};

function copyForStatus(status: TenantOnboardingApplicationStatus): WaitingCopy {
  switch (status) {
    case 'under_review':
      return {
        badge: 'Inceleniyor',
        title: 'Basvurunuz inceleniyor',
        body: 'Ekibimiz basvurunuzu degerlendiriyor. Sonuc hazir oldugunda bu ekrandan devam edebilirsiniz.',
      };
    case 'rejected':
      return {
        badge: 'Reddedildi',
        title: 'Basvurunuz onaylanmadi',
        body: 'Basvurunuz su an icin onaylanmadi. Detaylar icin tenant ekibimizle iletisime gecebilirsiniz.',
        danger: true,
      };
    case 'suspended':
      return {
        badge: 'Askiya alindi',
        title: 'Basvurunuz duraklatildi',
        body: 'Tenant hesabiniz gecici olarak duraklatildi. Durum guncellendiginde yeniden devam edebilirsiniz.',
        danger: true,
      };
    case 'submitted':
    default:
      return {
        badge: 'Onay bekliyor',
        title: 'Basvurunuz alindi',
        body: 'Basvurunuz inceleme sirasina alindi. Bu asamada form yerine durum ekranini gosteriyoruz.',
      };
  }
}

export default function TenantOnboardingWaitingPage() {
  const params = useParams();
  const router = useRouter();
  const rawStateToken = params.stateToken;
  const stateToken = Array.isArray(rawStateToken) ? rawStateToken[0] : rawStateToken;
  const [workspace, setWorkspace] = useState<TenantOnboardingWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stateToken) {
      setError('Gecersiz onboarding baglantisi.');
      return;
    }

    let cancelled = false;
    void getTenantOnboardingWorkspaceByStateToken(stateToken)
      .then((nextWorkspace) => {
        if (cancelled) {
          return;
        }
        // This compatibility alias is read-only. Keep the route token stable
        // instead of persisting a refreshed token from a workspace read.
        const stableWorkspace = {
          ...nextWorkspace,
          stateToken,
          application: {
            ...nextWorkspace.application,
            stateToken,
          },
        };
        const resumeUrl = getTenantOnboardingResumeUrl(stableWorkspace);
        if (!resumeUrl.endsWith('/waiting')) {
          router.replace(resumeUrl);
          return;
        }
        setWorkspace(stableWorkspace);
      })
      .catch(() => {
        if (!cancelled) {
          clearOnboardingStateToken();
          setError('Devam linki gecersiz veya suresi dolmus.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, stateToken]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
        <div className="w-full max-w-[460px] rounded-3xl border border-danger-200 bg-white p-8 text-center shadow-card">
          <h1 className="text-[24px] font-bold text-ink-900">Baglanti kullanilamiyor</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-500">{error}</p>
          <Button className="mt-6 h-11 rounded-full px-6" onClick={() => router.push('/')}>
            Yeni basvuruya don
          </Button>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const copy = copyForStatus(workspace.application.status);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-[500px] rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-card sm:p-10">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] ${
            copy.danger ? 'bg-danger-50 text-danger-700' : 'bg-warning-50 text-warning-700'
          }`}
        >
          {copy.badge}
        </span>
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
          {copy.danger ? (
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
        {workspace.revisionRequests.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3 text-left">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
              Inceleme notlari
            </p>
            <ul className="mt-2 space-y-1.5">
              {workspace.revisionRequests.map((note, index) => (
                <li key={index} className="text-[13px] leading-relaxed text-ink-600">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
