export type BadgeTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const toneClass: Record<BadgeTone, string> = {
  success: 'admin-badge admin-badge--success',
  warning: 'admin-badge admin-badge--warning',
  danger: 'admin-badge admin-badge--danger',
  accent: 'admin-badge admin-badge--accent',
  neutral: 'admin-badge',
};

/** Pill-style status indicator with an optional leading dot. */
export default function StatusBadge({
  label,
  tone = 'neutral',
  dot = true,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span className={`${toneClass[tone]}${dot ? ' admin-badge--dot' : ''}`}>
      {label}
    </span>
  );
}
