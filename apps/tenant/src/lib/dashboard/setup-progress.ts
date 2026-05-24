/**
 * Setup progress hesaplaması — tenant dashboard "next best action" rehberinin
 * pure logic katmanı. Hardcoded yüzde yok; her şey gerçek API sayımlarından
 * türetilir. Faz A — RC-3 prep.
 */

export type SetupStepId =
  | 'store'
  | 'category'
  | 'menuItem'
  | 'openingHours'
  | 'testOrder';

export type SetupStepStatus = 'done' | 'pending';

export type SetupStep = {
  id: SetupStepId;
  label: string;
  description: string;
  status: SetupStepStatus;
  ctaLabel: string;
  ctaHref: string;
};

export type SetupProgressInput = {
  storeCount: number;
  /** En az bir store'da bir günün kapalı olmadığı opening hours kaydı var mı? */
  hasOpeningHours: boolean;
  categoryCount: number;
  menuItemCount: number;
  /** Bugünkü canlı + geçmiş sipariş sayısı (test ya da gerçek fark etmez). */
  observedOrderCount: number;
};

export type SetupProgressResult = {
  steps: SetupStep[];
  doneCount: number;
  totalCount: number;
  percent: number;
  isComplete: boolean;
  nextStep: SetupStep | null;
};

const STUDIO_HREF = '/dashboard/studio';

export function computeSetupProgress(input: SetupProgressInput): SetupProgressResult {
  const steps: SetupStep[] = [
    {
      id: 'store',
      label: 'Restoran oluşturuldu',
      description: 'İlk restoran kaydını aç ve adres bilgilerini gir.',
      status: input.storeCount > 0 ? 'done' : 'pending',
      ctaLabel: 'Restoran oluştur',
      ctaHref: STUDIO_HREF,
    },
    {
      id: 'category',
      label: 'İlk kategori oluşturuldu',
      description: 'Menü için en az bir kategori (ör. Pizzalar) eklemelisin.',
      status: input.categoryCount > 0 ? 'done' : 'pending',
      ctaLabel: 'Kategori ekle',
      ctaHref: STUDIO_HREF,
    },
    {
      id: 'menuItem',
      label: 'Menüye ürün eklendi',
      description: 'En az bir ürün eklenmeden vitrin canlı olmaz.',
      status: input.menuItemCount > 0 ? 'done' : 'pending',
      ctaLabel: 'İlk ürünü ekle',
      ctaHref: STUDIO_HREF,
    },
    {
      id: 'openingHours',
      label: 'Çalışma saatleri ayarlandı',
      description: 'Hangi günlerde açık olduğunu belirt — müşteri sipariş penceresi buna bağlı.',
      status: input.hasOpeningHours ? 'done' : 'pending',
      ctaLabel: 'Saatleri ayarla',
      ctaHref: STUDIO_HREF,
    },
    {
      id: 'testOrder',
      label: 'Test siparişi alındı',
      description: 'Operasyonel akışı doğrulamak için en az bir sipariş üzerinden geç.',
      status: input.observedOrderCount > 0 ? 'done' : 'pending',
      ctaLabel: 'Test siparişi oluştur',
      ctaHref: '/orders',
    },
  ];

  const totalCount = steps.length;
  const doneCount = steps.filter((step) => step.status === 'done').length;
  const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  const isComplete = doneCount === totalCount;
  const nextStep = steps.find((step) => step.status === 'pending') ?? null;

  return { steps, doneCount, totalCount, percent, isComplete, nextStep };
}

/**
 * /stores/mine yanıtından çalışma saatlerinin "anlamlı" olup olmadığını
 * çıkarır. En az bir store'da, en az bir gün kapalı olmayan (isClosed=false)
 * ve openTime/closeTime dolu bir kayıt bekleniyor.
 */
export function hasMeaningfulOpeningHours(
  stores: ReadonlyArray<{
    openingHours?: ReadonlyArray<{
      isClosed?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    }> | null;
  }>,
): boolean {
  for (const store of stores) {
    const hours = store.openingHours;
    if (!hours || hours.length === 0) continue;
    for (const entry of hours) {
      if (entry.isClosed) continue;
      if (entry.openTime && entry.closeTime) return true;
    }
  }
  return false;
}
