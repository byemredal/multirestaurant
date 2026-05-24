import { Icon, type IconName } from '@/lib/icons';

export type TimelineEntry = {
  id: string;
  title: string;
  meta: string;
  icon?: IconName;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
};

const dotColor: Record<NonNullable<TimelineEntry['tone']>, string> = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  neutral: 'var(--muted-2)',
};

/** Vertical event timeline. */
export default function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="admin-timeline">
      {entries.map((entry) => {
        const EntryIcon = entry.icon ? Icon[entry.icon] : null;
        return (
          <div key={entry.id} className="admin-timeline__item">
            {EntryIcon ? (
              <span
                className="admin-feed-item__icon"
                style={{ width: 28, height: 28 }}
              >
                <EntryIcon width={15} height={15} />
              </span>
            ) : (
              <span
                className="admin-timeline__dot"
                style={{ background: dotColor[entry.tone ?? 'accent'] }}
              />
            )}
            <div>
              <div className="admin-timeline__title">{entry.title}</div>
              <div className="admin-timeline__meta">{entry.meta}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
