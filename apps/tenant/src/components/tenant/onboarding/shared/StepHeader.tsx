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
  stepIndex,
  totalSteps,
  status,
  updatedAt,
}: StepHeaderProps) {
  const tone =
    status === 'completed'
      ? 'bg-[#ecfdf3] text-[#067647] ring-1 ring-[#bbf7d0]'
      : status === 'needs_revision'
        ? 'bg-[#fff8ed] text-[#b54708] ring-1 ring-[#f3d7ac]'
        : status === 'in_progress'
          ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-100'
          : 'bg-ink-50 text-ink-500 ring-1 ring-ink-200';

  return (
    <div className="mb-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a8a29e]">
          {totalSteps > 0 ? `Adim ${stepIndex + 1} / ${totalSteps}` : 'Hazirlik'}
        </span>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${tone}`}
          >
            {STEP_STATUS_LABELS[status] ?? status}
          </span>
          <span className="text-[11px] text-[#a8a29e]">
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
      <h2 className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-[#1c1917] sm:text-[32px]">
        {title}
      </h2>
      <p className="mt-3 max-w-[640px] text-[15px] leading-7 text-[#586575]">{description}</p>
    </div>
  );
}
