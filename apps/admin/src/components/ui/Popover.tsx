'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Lightweight anchored popover used for header menus, switchers and row
 * actions. Closes on outside click and Escape.
 */
export default function Popover({
  trigger,
  children,
  align = 'right',
}: {
  /** Receives the current open state; should render a clickable element. */
  trigger: (open: boolean) => ReactNode;
  /** Menu body; receives a `close` callback. */
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="app-pop" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {open && (
        <div className={`app-menu app-menu--${align}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
