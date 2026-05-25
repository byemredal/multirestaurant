export type TenantOnboardingPlanCatalogEntry = {
  planKey: string;
  title: string;
  description: string;
  commissionSummary: string;
  monthlyFeeSummary: string | null;
  includedServices: string[];
  benefits: string[];
  limitations: string[];
  recommended: boolean;
  country: string;
  currency: string;
  active: boolean;
  sortOrder: number;
};

export function getTenantOnboardingPlanCatalog(
  country = 'CH',
  currency = 'CHF',
): TenantOnboardingPlanCatalogEntry[] {
  const disclaimer = 'Fiyatlandırma ve komisyon metinleri yalnızca yapılandırılabilir taslak içeriktir.';

  return [
    {
      planKey: 'basic_marketplace',
      title: 'Temel Pazaryeri Planı',
      description: 'İşletmeniz için basit bir listeleme ve sipariş başlangıç planı.',
      commissionSummary: 'Yapılandırılabilir komisyon taslağı',
      monthlyFeeSummary: null,
      includedServices: ['Pazaryeri listelemesi', 'Temel sipariş akışı'],
      benefits: ['Kolay başvuru başlangıcı', 'Temel pazaryeri görünürlüğü'],
      limitations: [disclaimer, 'Görünürlük seçenekleri ilerideki katalog yapılandırmasına göre değişebilir.'],
      recommended: false,
      country,
      currency,
      active: true,
      sortOrder: 10,
    },
    {
      planKey: 'growth',
      title: 'Büyüme Planı',
      description: 'Ek görünürlük desteğini değerlendiren iş ortakları için taslak paket.',
      commissionSummary: 'Yapılandırılabilir büyüme komisyonu taslağı',
      monthlyFeeSummary: 'Yapılandırılabilir hizmet ücreti taslağı',
      includedServices: ['Pazaryeri listelemesi', 'Temel sipariş akışı', 'Kampanya desteği taslağı'],
      benefits: ['Görünürlük seçenekleri taslağı', 'Pazarlama desteği taslağı'],
      limitations: [disclaimer, 'Hizmetler daha sonraki ülke ve sözleşme yapılandırmasına tabidir.'],
      recommended: true,
      country,
      currency,
      active: true,
      sortOrder: 20,
    },
    {
      planKey: 'delivery_support',
      title: 'Teslimat Destek Planı',
      description: 'Teslimatla ilgili operasyon desteği için taslak paket.',
      commissionSummary: 'Yapılandırılabilir teslimat hizmeti taslağı',
      monthlyFeeSummary: null,
      includedServices: ['Pazaryeri listelemesi', 'Sipariş akışı', 'Teslimat desteği taslağı'],
      benefits: ['Operasyon desteği taslağı', 'Teslimat seçeneği taslağı'],
      limitations: [disclaimer, 'Bu başvuru seçimi teslimat hizmetinin sunulacağını garanti etmez.'],
      recommended: false,
      country,
      currency,
      active: true,
      sortOrder: 30,
    },
  ];
}
