import type { ReactNode } from 'react';
import AdminShell, { type SidebarBadgeMap } from './AdminShell';

export default function AdminSurface({
  title,
  description,
  children,
  badges,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  badges?: SidebarBadgeMap;
}) {
  return (
    <AdminShell title={title} description={description} badges={badges}>
      <div style={{ display: 'grid', gap: 16 }}>{children}</div>
    </AdminShell>
  );
}
