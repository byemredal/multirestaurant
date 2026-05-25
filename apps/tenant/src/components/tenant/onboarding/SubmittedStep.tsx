'use client';

import { useMemo } from 'react';
import { Card } from '@lieferzonen/ui';
import type { TenantOnboardingResolvedSession, TenantOnboardingWorkspace } from '@/lib/tenant-onboarding-client';
import { getSubmittedCopy } from './onboarding-country-pack';

type SubmittedStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Gönderildi',
  under_review: 'İnceleniyor',
  rejected: 'İnceleme tamamlandı',
  suspended: 'Beklemeye alındı',
};

export function SubmittedStep({ resolvedSession, workspace }: SubmittedStepProps) {
  const copy = useMemo(() => getSubmittedCopy(), []);
  const status = resolvedSession?.status ?? workspace.application.status;
  const label = STATUS_LABELS[status] ?? 'Gönderildi';

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <div className="mx-auto max-w-[560px] py-8 text-center sm:py-14">
        <span className="inline-flex rounded-full bg-success-50 px-3 py-1 text-[12px] font-semibold text-success-700">
          {label}
        </span>
        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-[8px] bg-success-50 text-[26px] font-bold text-success-700">
          OK
        </div>
        <h2 className="mt-6 text-[28px] font-bold text-ink-900 sm:text-[32px]">{copy.title}</h2>
        <p className="mx-auto mt-3 max-w-[470px] text-[15px] leading-7 text-ink-600">{copy.body}</p>
        <p className="mx-auto mt-5 max-w-[470px] rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-3 text-[13px] leading-6 text-ink-600">
          {copy.note}
        </p>
        <dl className="mx-auto mt-8 grid max-w-[430px] gap-3 rounded-[8px] border border-ink-100 p-4 text-left text-[13px] sm:grid-cols-2">
          <dt className="text-ink-500">Başvuru durumu</dt>
          <dd className="font-semibold text-ink-800">{label}</dd>
          <dt className="text-ink-500">Gönderilme tarihi</dt>
          <dd className="font-semibold text-ink-800">
            {workspace.application.submittedAt
              ? new Date(workspace.application.submittedAt).toLocaleString('tr-TR')
              : 'Güncelleme bekleniyor'}
          </dd>
        </dl>
      </div>
    </Card>
  );
}
