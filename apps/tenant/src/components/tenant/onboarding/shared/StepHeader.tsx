'use client';

const STEP_STATUS_LABELS: Record<string, string> = {
  not_started: 'Başlanmadı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  needs_revision: 'Revizyon Gerekli',
};

export type StepHeaderProps = {
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  status: string;
  updatedAt: string;
};

export function StepHeader({
  title,
  description,
  status,
  updatedAt,
}: StepHeaderProps) {
  const tone =
    status === 'completed'
      ? 'bg-success-50 text-success-700 ring-1 ring-success-100'
      : status === 'needs_revision'
        ? 'bg-warning-50 text-warning-600 ring-1 ring-warning-200'
        : status === 'in_progress'
          ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-100'
          : 'bg-ink-50 text-ink-500 ring-1 ring-ink-200';

  return (
    <div className="mb-9 text-center">
      <h2 className="text-[27px] font-semibold leading-tight text-ink-900 sm:text-[32px]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-[580px] text-[14px] leading-6 text-ink-500">{description}</p>
      <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-3 text-[11px] text-ink-400">
        <span className={`rounded-[4px] px-2.5 py-1 font-medium ${tone}`}>
          {STEP_STATUS_LABELS[status] ?? status}
        </span>
        <span>
          Güncellendi{' '}
          {new Date(updatedAt).toLocaleString('tr-TR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
