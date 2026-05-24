import { defaultWeek, SampleTemplate } from './types';

export const burgerTemplate: SampleTemplate = {
  key: 'burger',
  displayLabel: 'Örnek Burger Lokali',
  store: {
    name: 'Örnek Burger Lokali',
    category: 'burger',
    description: 'Smashed patty, taze ekmek ve ev usulü soslar.',
    addressLine1: 'Limmatquai 28',
    city: 'Zürich',
    postalCode: '8001',
    country: 'Switzerland',
    phoneNumber: '+41 44 200 10 02',
  },
  openingHours: defaultWeek('11:30', '23:00'),
  categories: [
    {
      name: 'Burgerler',
      sortOrder: 0,
      items: [
        {
          name: 'Klasik Cheeseburger',
          description: '120 gr smashed patty, cheddar, turşu, soğan.',
          basePrice: 13.5,
          sortOrder: 0,
        },
        {
          name: 'Double Bacon',
          description: 'Çift patty, çıtır jambon, cheddar, BBQ sos.',
          basePrice: 17.0,
          sortOrder: 1,
        },
        {
          name: 'Veggie Burger',
          description: 'Nohut köfte, közlenmiş biber, yoğurtlu sarımsak sosu.',
          basePrice: 14.0,
          sortOrder: 2,
        },
      ],
    },
    {
      name: 'Yan Ürünler',
      sortOrder: 1,
      items: [
        {
          name: 'Ev usulü patates',
          description: 'Kabuklu, taze çekilmiş tuzlu.',
          basePrice: 5.5,
          sortOrder: 0,
        },
        {
          name: 'Tatlı patates',
          description: 'Hafif karamelize, kekikli sosla.',
          basePrice: 6.5,
          sortOrder: 1,
        },
        {
          name: 'Soğan halkası',
          description: 'Çıtır panko soğan halkaları.',
          basePrice: 6.0,
          sortOrder: 2,
        },
      ],
    },
    {
      name: 'İçecekler',
      sortOrder: 2,
      items: [
        {
          name: 'Limonata',
          description: 'Taze sıkım, naneli.',
          basePrice: 4.5,
          sortOrder: 0,
        },
        {
          name: 'Cola 330 ml',
          description: '',
          basePrice: 4.0,
          sortOrder: 1,
        },
        {
          name: 'Maden suyu',
          description: '',
          basePrice: 3.5,
          sortOrder: 2,
        },
      ],
    },
  ],
};
