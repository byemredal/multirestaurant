import { defaultWeek, SampleTemplate } from './types';

export const pizzaTemplate: SampleTemplate = {
  key: 'pizza',
  displayLabel: 'Örnek Pizza Restoranı',
  store: {
    name: 'Örnek Pizza Restoranı',
    category: 'pizza',
    description: 'İnce hamurlu, taş fırın pizzalar ve eşlikçi atıştırmalıklar.',
    addressLine1: 'Bahnhofstrasse 12',
    city: 'Zürich',
    postalCode: '8001',
    country: 'Switzerland',
    phoneNumber: '+41 44 200 10 01',
  },
  openingHours: defaultWeek('11:00', '23:00'),
  categories: [
    {
      name: 'Klasik Pizzalar',
      sortOrder: 0,
      items: [
        {
          name: 'Margherita',
          description: 'Domates sosu, mozzarella, taze fesleğen.',
          basePrice: 14.5,
          sortOrder: 0,
        },
        {
          name: 'Funghi',
          description: 'Mantar, mozzarella, kekik.',
          basePrice: 16.0,
          sortOrder: 1,
        },
        {
          name: 'Prosciutto',
          description: 'Jambon, mozzarella, oregano.',
          basePrice: 17.5,
          sortOrder: 2,
        },
      ],
    },
    {
      name: 'Özel Pizzalar',
      sortOrder: 1,
      items: [
        {
          name: 'Quattro Stagioni',
          description: 'Mantar, jambon, enginar, zeytin.',
          basePrice: 19.0,
          sortOrder: 0,
        },
        {
          name: 'Diavola',
          description: 'Acı salam, jalapeño, mozzarella.',
          basePrice: 18.5,
          sortOrder: 1,
        },
        {
          name: 'Vegetariana',
          description: 'Biber, mantar, soğan, mısır, mozzarella.',
          basePrice: 17.0,
          sortOrder: 2,
        },
      ],
    },
    {
      name: 'İçecekler',
      sortOrder: 2,
      items: [
        {
          name: 'Cola 330 ml',
          description: '',
          basePrice: 4.0,
          sortOrder: 0,
        },
        {
          name: 'Maden suyu',
          description: '',
          basePrice: 3.5,
          sortOrder: 1,
        },
        {
          name: 'Ev ayranı',
          description: '',
          basePrice: 4.5,
          sortOrder: 2,
        },
      ],
    },
  ],
};
