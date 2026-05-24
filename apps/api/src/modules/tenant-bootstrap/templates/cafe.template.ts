import { defaultWeek, SampleTemplate } from './types';

export const cafeTemplate: SampleTemplate = {
  key: 'cafe',
  displayLabel: 'Örnek Kafe',
  store: {
    name: 'Örnek Kafe',
    category: 'cafe',
    description: 'Specialty kahve, ev yapımı pastalar ve hafif atıştırmalıklar.',
    addressLine1: 'Niederdorfstrasse 5',
    city: 'Zürich',
    postalCode: '8001',
    country: 'Switzerland',
    phoneNumber: '+41 44 200 10 03',
  },
  openingHours: defaultWeek('07:30', '20:00'),
  categories: [
    {
      name: 'Kahveler',
      sortOrder: 0,
      items: [
        {
          name: 'Espresso',
          description: 'Tek shot, single origin çekirdek.',
          basePrice: 3.8,
          sortOrder: 0,
        },
        {
          name: 'Cappuccino',
          description: 'Sütlü, taze çırpılmış köpük.',
          basePrice: 5.0,
          sortOrder: 1,
        },
        {
          name: 'Flat White',
          description: 'Çift shot, mikroköpüklü süt.',
          basePrice: 5.5,
          sortOrder: 2,
        },
        {
          name: 'Filtre kahve',
          description: 'Günün çekirdeği, V60.',
          basePrice: 4.5,
          sortOrder: 3,
        },
      ],
    },
    {
      name: 'Pastalar',
      sortOrder: 1,
      items: [
        {
          name: 'Cheesecake',
          description: 'Klasik New York usulü.',
          basePrice: 6.5,
          sortOrder: 0,
        },
        {
          name: 'Brownie',
          description: 'Bitter çikolatalı, içi yumuşak.',
          basePrice: 5.5,
          sortOrder: 1,
        },
        {
          name: 'Mevsim meyveli tart',
          description: 'Vanilyalı krema ve taze meyve.',
          basePrice: 6.0,
          sortOrder: 2,
        },
      ],
    },
    {
      name: 'Atıştırmalıklar',
      sortOrder: 2,
      items: [
        {
          name: 'Avokadolu tost',
          description: 'Çavdar ekmeği, taze avokado, biber.',
          basePrice: 9.5,
          sortOrder: 0,
        },
        {
          name: 'Granola kasesi',
          description: 'Yoğurt, mevsim meyveleri, ev granolası.',
          basePrice: 8.5,
          sortOrder: 1,
        },
        {
          name: 'Kruvasan',
          description: 'Tereyağlı, gün içi taze.',
          basePrice: 3.8,
          sortOrder: 2,
        },
      ],
    },
  ],
};
