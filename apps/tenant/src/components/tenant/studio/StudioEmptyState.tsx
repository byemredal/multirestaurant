'use client';

import type { ReactElement } from 'react';

export type StudioEmptyVariant = 'no-category' | 'no-product' | 'empty-filter';

export function StudioEmptyState({
  variant,
  filterLabel,
  onPrimary,
}: {
  variant: StudioEmptyVariant;
  filterLabel?: string;
  onPrimary: () => void;
}): ReactElement {
  const config = configFor(variant, filterLabel);

  return (
    <div className="grid place-items-center rounded-[16px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#09479A]/[0.06] text-[#09479A]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 9.5 5 5h14l2 4.5" />
          <path d="M3 9.5h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0v-2Z" />
          <path d="M5 13v7h14v-7" />
        </svg>
      </span>
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
        {config.title}
      </h3>
      <p className="mt-1.5 max-w-[420px] text-[12.5px] leading-6 text-slate-500">
        {config.description}
      </p>
      <button
        type="button"
        onClick={onPrimary}
        className="mt-4 rounded-[10px] bg-[#09479A] px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_18px_rgba(9,71,154,0.22)] transition hover:bg-[#073a82]"
      >
        {config.cta}
      </button>
    </div>
  );
}

function configFor(variant: StudioEmptyVariant, filterLabel?: string) {
  if (variant === 'no-category') {
    return {
      title: 'Önce bir kategori oluştur',
      description:
        'Menünü gruplamak için ilk kategoriyi (ör. Pizzalar, İçecekler) ekle — ardından ürünleri buna bağla.',
      cta: 'Kategori oluştur',
    };
  }
  if (variant === 'empty-filter') {
    return {
      title: `${filterLabel ?? 'Bu kategoride'} henüz ürün yok`,
      description:
        'Bu kategori altına ilk ürünü ekleyerek başla. İsim ve fiyat yeterli — detayları sonra ekleyebilirsin.',
      cta: 'Ürün ekle',
    };
  }
  return {
    title: 'Henüz ürün yok',
    description:
      'İlk ürünü oluşturarak başla. İsim ve fiyat yeterli — detayları sonra ekleyebilirsin.',
    cta: 'İlk ürünü ekle',
  };
}
