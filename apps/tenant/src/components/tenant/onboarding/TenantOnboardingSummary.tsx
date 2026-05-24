import type { TenantOnboardingWorkspace } from '@/lib/tenant-onboarding-client';

const APP_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  under_review: 'İncelemede',
  revision_required: 'Revizyon Gerekli',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  active: 'Aktif',
  suspended: 'Askıya Alındı',
};

const APP_STATUS_DESCRIPTIONS: Record<string, string> = {
  draft: 'Bilgileri doldurup başvurunuzu incelemeye gönderin.',
  submitted: 'Başvurunuz alındı. Ekip en kısa sürede inceleyecek.',
  under_review: 'Başvurunuz inceleniyor. Sonuç çıktığında bilgilendirileceksiniz.',
  revision_required: 'Bazı adımlarda düzeltme istendi. Notları kontrol edin ve yeniden gönderin.',
  approved: 'Başvurunuz onaylandı. Aktivasyon adımıyla yayına geçebilirsiniz.',
  rejected: 'Başvurunuz reddedildi. Destek ekibiyle iletişime geçin.',
  active: 'Hesabınız aktif. Tenant stüdyosundan menünüzü yönetebilirsiniz.',
  suspended: 'Hesabınız askıya alındı. Detaylar için destek ekibiyle iletişime geçin.',
};

const POLLING_STATUSES = new Set(['submitted', 'under_review', 'revision_required']);

function statusTone(status: string) {
  if (status === 'approved' || status === 'active') {
    return {
      badge: 'bg-[#ecfdf3] text-[#067647] ring-1 ring-[#bbf7d0]',
      card: 'border-[#bbf7d0] bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_70%)]',
      bar: 'bg-primary',
      dot: 'bg-primary',
    };
  }
  if (status === 'rejected' || status === 'suspended') {
    return {
      badge: 'bg-[#fff1f0] text-[#b42318] ring-1 ring-[#fda29b]',
      card: 'border-[#fda29b] bg-[linear-gradient(180deg,#fff5f5_0%,#ffffff_70%)]',
      bar: 'bg-[#b42318]',
      dot: 'bg-[#b42318]',
    };
  }
  if (status === 'revision_required') {
    return {
      badge: 'bg-[#fff8ed] text-[#b54708] ring-1 ring-[#f3d7ac]',
      card: 'border-[#f3d7ac] bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_70%)]',
      bar: 'bg-[#b54708]',
      dot: 'bg-[#b54708]',
    };
  }
  if (status === 'under_review' || status === 'submitted') {
    return {
      badge: 'bg-[#fff1e6] text-[#c2410c] ring-1 ring-[#fed7aa]',
      card: 'border-[#fed7aa] bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_70%)]',
      bar: 'bg-primary',
      dot: 'bg-primary',
    };
  }
  return {
    badge: 'bg-[#f4f6f8] text-[#44403c] ring-1 ring-[#e2e8f0]',
    card: 'bg-secondary/15 border-secondary/25',
    bar: 'bg-primary',
    dot: 'bg-primary',
  };
}

function formatDate(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function formatTime(value: Date | null) {
  if (!value) return null;
  return value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TenantOnboardingSummary({
  workspace,
  lastCheckedAt,
}: {
  workspace: TenantOnboardingWorkspace;
  lastCheckedAt?: Date | null;
}) {
  const completed = workspace.steps.filter((s) => s.status === 'completed').length;
  const total = workspace.steps.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const status = workspace.application.status;
  const appStatusLabel = APP_STATUS_LABELS[status] ?? status;
  const description = APP_STATUS_DESCRIPTIONS[status] ?? '';
  const tones = statusTone(status);
  const isLive = POLLING_STATUSES.has(status);

  const timeline: Array<{ label: string; value: string | null }> = [
    { label: 'Gönderildi', value: formatDate(workspace.application.submittedAt) },
    { label: 'İnceleme', value: formatDate(workspace.application.reviewStartedAt) },
    { label: 'Onay', value: formatDate(workspace.application.approvedAt) },
    { label: 'Aktivasyon', value: formatDate(workspace.application.activatedAt) },
  ];
  if (workspace.application.revisionRequestedAt) {
    timeline.push({ label: 'Revizyon talebi', value: formatDate(workspace.application.revisionRequestedAt) });
  }
  if (workspace.application.rejectedAt) {
    timeline.push({ label: 'Reddedildi', value: formatDate(workspace.application.rejectedAt) });
  }
  if (workspace.application.suspendedAt) {
    timeline.push({ label: 'Askıya alındı', value: formatDate(workspace.application.suspendedAt) });
  }
  const filledTimeline = timeline.filter((t) => Boolean(t.value));

  return (
    <div className="mt-3">
      <div
        className={`py-4`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8a29e]">
                Tenantlik Durumu
              </p>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#44403c] ring-1 ring-[#ece2d2]">
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${tones.dot}`}>
                    <span className={`absolute inset-0 animate-ping rounded-full ${tones.dot} opacity-70`} />
                  </span>
                  Canlı
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em] ${tones.badge}`}
              >
                {appStatusLabel}
              </span>
              <span className="text-[12px] text-[#78716c]">
                Revizyon{' '}
                <strong className="font-semibold text-[#44403c]">
                  #{workspace.application.currentRevisionNumber}
                </strong>
              </span>
            </div>
            {description && (
              <p className="mt-1 text-[13px] leading-5 text-[#586575]">{description}</p>
            )}
          </div>

          <div className="flex w-full flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-bold tracking-[-0.02em] text-gray-600">
                {progress}%
              </span>
              <span className="text-[11px] text-gray-500">
                ({completed}/{total} adım)
              </span>
            </div>
            <div className="flex items-center h-3 p-2 w-full border border-primary/30 overflow-hidden rounded-full bg-primary/20">
              <div
                className={`h-2 rounded-full transition-all ${tones.bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* {lastCheckedAt && isLive && (
              <span className="text-[10px] text-[#a8a29e]">
                Son güncelleme {formatTime(lastCheckedAt)}
              </span>
            )} */}
          </div>
        </div>

        {filledTimeline.length > 0 && (
          <>
            <div className="my-3 h-px w-full bg-[#ece2d2]/70" />
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {filledTimeline.map((entry) => (
                <div key={entry.label} className="flex flex-col">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a8a29e]">
                    {entry.label}
                  </dt>
                  <dd className="text-[12px] font-medium text-[#1c1917]">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>

      {workspace.revisionRequests.length > 0 && (
        <div className="mt-2.5 rounded-[14px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#b54708]">
            Revizyon Talepleri
          </p>
          <ul className="mt-1.5 grid gap-1 text-[13px] text-[#586575]">
            {workspace.revisionRequests.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
