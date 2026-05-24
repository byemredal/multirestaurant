'use client';

import {
  type FormEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { Button, Select, cn } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { useTenantStores } from '@/lib/tenant-store-context';
import {
  createTenantTestOrder,
  listTenantMenuItems,
} from '@/lib/tenant-client';
import { useTenantOrderStream } from '@/lib/realtime/tenant-order-stream-context';

type MenuItemRow = {
  id: string;
  name: string;
  basePrice: number;
  currencyCode: string;
  isActive?: boolean;
  categoryName?: string | null;
};

/**
 * Operational tooling — gerçek backend üzerinden tek tıkla test siparişi
 * üretir. Realtime stream, dashboard ve audio pulse zincirini gerçek
 * lifecycle ile doğrulamak için. Customer-facing bir feature değil.
 */
export function TestOrderLauncher({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement | null {
  const { session } = useTenantAuth();
  const { stores, activeStoreId } = useTenantStores();
  const { refresh: refreshStream } = useTenantOrderStream();

  const [storeId, setStoreId] = useState<string>('');
  const [serviceType, setServiceType] = useState<'pickup' | 'delivery'>('pickup');
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);

  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setStoreId(activeStoreId ?? stores[0]?.id ?? '');
    setServiceType('pickup');
    setSelectedIds(new Set());
    setFeedback(null);
  }, [open, activeStoreId, stores]);

  const loadItems = useCallback(
    async (selectedStoreId: string) => {
      if (!session || !selectedStoreId) return;
      setItemsLoading(true);
      setItemsError(null);
      try {
        const list = await listTenantMenuItems(session, selectedStoreId);
        const mapped = ((list ?? []) as MenuItemRow[]).map((it) => ({
          id: it.id,
          name: it.name,
          basePrice: Number(it.basePrice),
          currencyCode: it.currencyCode,
          isActive: it.isActive,
          categoryName: it.categoryName ?? null,
        }));
        // sadece aktif ürünler test edilebilir
        setItems(mapped.filter((it) => it.isActive !== false));
      } catch {
        setItemsError('Ürün listesi yüklenemedi.');
      } finally {
        setItemsLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (!open || !storeId) return;
    void loadItems(storeId);
  }, [open, storeId, loadItems]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const totalSelected = selectedIds.size;
  const previewTotal = useMemo(() => {
    if (selectedIds.size === 0) return null;
    let sum = 0;
    let currency = '';
    for (const item of items) {
      if (!selectedIds.has(item.id)) continue;
      sum += item.basePrice;
      currency = item.currencyCode;
    }
    return { amount: Math.round((sum + Number.EPSILON) * 100) / 100, currency };
  }, [selectedIds, items]);

  function toggleItem(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !storeId || selectedIds.size === 0 || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await createTenantTestOrder(session, {
        storeId,
        menuItemIds: Array.from(selectedIds),
        serviceType,
      });
      setFeedback({
        type: 'success',
        message: `Test siparişi oluşturuldu — #${result.orderId.slice(0, 8)} · ${result.totalAmount.toFixed(2)} ${result.currency}`,
      });
      // Realtime stream'i hemen tetikle ki sipariş dashboard'da görünsün.
      void refreshStream();
      setSelectedIds(new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test siparişi oluşturulamadı.';
      setFeedback({ type: 'error', message });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const canSubmit = !busy && selectedIds.size > 0 && storeId.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:px-4"
    >
      <button
        type="button"
        aria-label="Kapat"
        tabIndex={-1}
        onClick={() => {
          if (!busy) onClose();
        }}
        className="absolute inset-0 bg-slate-900/40"
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full max-w-lg flex-col rounded-t-[20px] border border-slate-100 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)] sm:max-h-[85vh] sm:rounded-[20px]"
      >
        <div className="border-b border-slate-100 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                Operational tooling
              </div>
              <h2
                id={titleId}
                className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-slate-900"
              >
                Test siparişi oluştur
              </h2>
              <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
                Gerçek backend üzerinden bir sipariş üretilir. Realtime stream, dashboard ve audio pulse
                zincirini doğrulamak için kullan. Stripe çağrılmaz.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Restoran">
              <Select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                disabled={busy}
              >
                {stores.length === 0 ? <option value="">—</option> : null}
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Servis tipi">
              <Select
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value as 'pickup' | 'delivery')}
                disabled={busy}
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              Ürünler
            </span>
            <span className="text-[11.5px] text-slate-500 tabular-nums">
              {totalSelected}/10 seçildi
            </span>
          </div>

          {itemsLoading ? (
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-[12px] bg-slate-50" />
              ))}
            </div>
          ) : itemsError ? (
            <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-3 text-[12.5px] text-red-700">
              {itemsError}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12.5px] text-slate-500">
              Bu restoranda aktif ürün yok. Önce Studio'dan ürün ekle.
            </div>
          ) : (
            <ul className="grid gap-1.5">
              {items.map((item) => {
                const checked = selectedIds.has(item.id);
                const atLimit = !checked && totalSelected >= 10;
                return (
                  <li key={item.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 transition',
                        checked
                          ? 'border-[#09479A]/25 bg-[#09479A]/[0.05]'
                          : atLimit
                            ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                            : 'border-slate-100 bg-white hover:border-[#09479A]/20',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy || atLimit}
                        onChange={() => toggleItem(item.id)}
                        className="h-4 w-4 shrink-0 accent-[#09479A]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold tracking-[-0.005em] text-slate-900">
                          {item.name}
                        </span>
                        {item.categoryName ? (
                          <span className="block truncate text-[11px] text-slate-500">
                            {item.categoryName}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-[#09479A]">
                        {item.basePrice.toFixed(2)} {item.currencyCode}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 p-6">
          {feedback ? (
            <div
              className={cn(
                'mb-3 rounded-[12px] px-3 py-2 text-[12.5px]',
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700',
              )}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12.5px] text-slate-500">
              {previewTotal ? (
                <>
                  Tahmini tutar:{' '}
                  <span className="font-semibold tabular-nums text-slate-800">
                    {previewTotal.amount.toFixed(2)} {previewTotal.currency}
                  </span>
                </>
              ) : (
                <span>Seçili ürün yok</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  if (!busy) onClose();
                }}
                disabled={busy}
              >
                Kapat
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {busy ? 'Oluşturuluyor…' : 'Sipariş oluştur'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
