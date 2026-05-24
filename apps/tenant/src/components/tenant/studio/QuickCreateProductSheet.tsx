'use client';

import {
  type FormEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from 'react';
import { Button, Input, Select } from '@lieferzonen/ui';

type CategoryOption = { id: string; name: string };
type CurrencyOption = { id: string; code: string; symbol?: string | null };

export type QuickCreateProductInput = {
  name: string;
  basePrice: string;
  currencyId: string;
  categoryId: string;
};

export function QuickCreateProductSheet({
  open,
  busy,
  categories,
  currencies,
  defaultCategoryId,
  onClose,
  onSubmit,
  onSwitchToFullForm,
}: {
  open: boolean;
  busy: boolean;
  categories: CategoryOption[];
  currencies: CurrencyOption[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSubmit: (input: QuickCreateProductInput) => void;
  onSwitchToFullForm: () => void;
}): ReactElement | null {
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setName('');
    setBasePrice('');
    setCurrencyId(currencies[0]?.id ?? '');
    setCategoryId(defaultCategoryId ?? '');
  }, [open, currencies, defaultCategoryId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit =
    !busy && name.trim().length > 0 && basePrice.trim().length > 0 && currencyId.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      basePrice: basePrice.trim(),
      currencyId,
      categoryId,
    });
  }

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
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-t-[20px] border border-slate-100 bg-white p-6 shadow-[0_24px_48px_rgba(15,23,42,0.18)] sm:rounded-[20px]"
      >
        <h2
          id={titleId}
          className="text-[16px] font-semibold tracking-[-0.01em] text-slate-900"
        >
          Hızlı ürün oluştur
        </h2>
        <p className="mt-1 text-[12px] leading-5 text-slate-500">
          İsim ve fiyat yeterli. Detayları sonra ürün kartına tıklayarak ekleyebilirsin.
        </p>

        <div className="mt-4 grid gap-3">
          <Field label="Ürün adı">
            <Input
              autoFocus
              value={name}
              placeholder="Adana Kebap"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Fiyat">
              <Input
                value={basePrice}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(event) => setBasePrice(event.target.value)}
              />
            </Field>
            <Field label="Para birimi">
              <Select
                value={currencyId}
                onChange={(event) => setCurrencyId(event.target.value)}
              >
                {currencies.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))
                )}
              </Select>
            </Field>
          </div>
          {categories.length > 0 ? (
            <Field label="Kategori (opsiyonel)">
              <Select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Kategorisiz</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToFullForm();
            }}
            className="text-[12.5px] font-semibold text-slate-500 transition hover:text-[#09479A]"
          >
            Detaylı oluştur →
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} type="button">
              İptal
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Oluştur
            </Button>
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
