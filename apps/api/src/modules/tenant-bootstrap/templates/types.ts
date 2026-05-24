import { DayOfWeek } from '../../stores/entities/store.entity';

export type SampleTemplateKey = 'pizza' | 'burger' | 'cafe';

export type SampleTemplate = {
  key: SampleTemplateKey;
  displayLabel: string;
  store: {
    name: string;
    category: string;
    description: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string;
    phoneNumber: string;
  };
  openingHours: Array<{
    dayOfWeek: DayOfWeek;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }>;
  categories: Array<{
    name: string;
    sortOrder: number;
    items: Array<{
      name: string;
      description: string;
      basePrice: number;
      sortOrder: number;
    }>;
  }>;
};

/**
 * 7 günlük standart çalışma saatleri — bütün template'ler için ortak
 * default. Cafe template kendi içinde override ediyor (daha erken açılış).
 */
export function defaultWeek(openTime = '11:00', closeTime = '23:00') {
  const days: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
  ];
  return days.map((dayOfWeek) => ({
    dayOfWeek,
    openTime,
    closeTime,
    isClosed: false,
  }));
}
