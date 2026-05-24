import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/lib/icons';

/** Centered empty / zero-data state with an icon and optional action. */
export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const StateIcon = Icon[icon];
  return (
    <div
      className="admin-state"
      style={{ display: 'grid', gap: 10, justifyItems: 'center', padding: '44px 24px' }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--surface-muted)',
          color: 'var(--muted)',
        }}
      >
        <StateIcon width={22} height={22} />
      </span>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
        {title}
      </div>
      {description && (
        <div style={{ maxWidth: 380, color: 'var(--muted)' }}>{description}</div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
