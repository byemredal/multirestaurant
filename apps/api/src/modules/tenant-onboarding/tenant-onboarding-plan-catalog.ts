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
  const disclaimer = 'Pricing and commission text is configurable placeholder copy only.';

  return [
    {
      planKey: 'basic_marketplace',
      title: 'Basic Marketplace Plan',
      description: 'A simple listing and ordering starting point for your business.',
      commissionSummary: 'Configurable commission placeholder',
      monthlyFeeSummary: null,
      includedServices: ['Marketplace listing', 'Basic order flow'],
      benefits: ['Simple onboarding start', 'Core marketplace presence'],
      limitations: [disclaimer, 'Visibility options may vary by future catalog configuration.'],
      recommended: false,
      country,
      currency,
      active: true,
      sortOrder: 10,
    },
    {
      planKey: 'growth',
      title: 'Growth Plan',
      description: 'A placeholder package for partners considering additional visibility support.',
      commissionSummary: 'Configurable growth commission placeholder',
      monthlyFeeSummary: 'Configurable service fee placeholder',
      includedServices: ['Marketplace listing', 'Basic order flow', 'Campaign support placeholder'],
      benefits: ['Visibility options placeholder', 'Marketing support placeholder'],
      limitations: [disclaimer, 'Services are subject to later country and contract configuration.'],
      recommended: true,
      country,
      currency,
      active: true,
      sortOrder: 20,
    },
    {
      planKey: 'delivery_support',
      title: 'Delivery Support Plan',
      description: 'A placeholder package for delivery-related operational support.',
      commissionSummary: 'Configurable delivery service placeholder',
      monthlyFeeSummary: null,
      includedServices: ['Marketplace listing', 'Order flow', 'Delivery support placeholder'],
      benefits: ['Operational support placeholder', 'Delivery option placeholder'],
      limitations: [disclaimer, 'Delivery availability is not guaranteed by this onboarding selection.'],
      recommended: false,
      country,
      currency,
      active: true,
      sortOrder: 30,
    },
  ];
}
