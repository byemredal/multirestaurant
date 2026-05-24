'use client';

import { useEffect, useRef, useState } from 'react';

const PULSE_MS = 6_000;

/**
 * Stream context'inin `newOrderIds` set'ini takip eder, her yeni gelen ID
 * için `PULSE_MS` (6 sn) süreyle "pulsing" state'inde tutar ve süre dolunca
 * düşürür. İşaretlendiği anda `markSeen(ids)` çağırarak stream context'in
 * sayacını sıfırlar — sonsuz döngü oluşmaz.
 *
 * Hem orders/page.tsx hem TenantOperationsDashboard tarafından aynı UX'i
 * paylaşır: tek hook, tek timer mekanizması.
 */
export function usePulseTracker(
  newOrderIds: ReadonlySet<string>,
  markSeen: (ids?: string[]) => void,
): Set<string> {
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (newOrderIds.size === 0) return;
    const ids = Array.from(newOrderIds);
    setPulsingIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
    for (const id of ids) {
      const existing = timersRef.current.get(id);
      if (existing) window.clearTimeout(existing);
      const tid = window.setTimeout(() => {
        setPulsingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        timersRef.current.delete(id);
      }, PULSE_MS);
      timersRef.current.set(id, tid);
    }
    markSeen(ids);
  }, [newOrderIds, markSeen]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Array.from(timers.values()).forEach((tid) => window.clearTimeout(tid));
    };
  }, []);

  return pulsingIds;
}
