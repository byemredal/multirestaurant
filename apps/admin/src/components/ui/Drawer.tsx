'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon } from '@/lib/icons';

/**
 * Right-anchored detail drawer. Used to inspect a table row without leaving
 * the list context. Closes on Escape and backdrop click.
 */
export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="admin-drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="admin-drawer" role="dialog" aria-modal="true">
        <div className="admin-drawer__header">
          <div>
            <div className="admin-drawer__title">{title}</div>
            {subtitle && <div className="admin-drawer__subtitle">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon.close width={16} height={16} />
          </button>
        </div>
        <div className="admin-drawer__body">{children}</div>
        {footer && <div className="admin-drawer__footer">{footer}</div>}
      </aside>
    </div>
  );
}

/** Key/value list used inside drawers. */
export function DrawerField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="admin-kv__label">{label}</div>
      <div className="admin-kv__value">{children}</div>
    </div>
  );
}
