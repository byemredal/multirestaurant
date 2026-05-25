import type { TenantOnboardingCountryPack } from '@/lib/tenant-onboarding-client';

export type BusinessDetailsFieldKey =
  | 'registrationNumber'
  | 'registeredBusinessName'
  | 'legalForm'
  | 'taxNumber'
  | 'vatNumber'
  | 'registrationCountry'
  | 'registeredAddress';

export type BusinessDetailsFieldConfig = {
  key: BusinessDetailsFieldKey;
  label: string;
  required: boolean;
  helpText?: string;
};

export type AuthorizedPersonFieldKey =
  | 'fullName'
  | 'email'
  | 'phoneNumber'
  | 'roleTitle'
  | 'ownershipPercentage';

export type AuthorizedPersonFieldConfig = {
  key: AuthorizedPersonFieldKey;
  label: string;
  required: boolean;
  helpText?: string;
};

export type BankDetailsFieldKey = 'bankName' | 'accountHolderName' | 'iban' | 'currency';
export type BillingAddressFieldKey =
  | 'useBusinessAddress'
  | 'billingName'
  | 'country'
  | 'city'
  | 'postalCode'
  | 'addressLine1'
  | 'addressLine2';

export type OnboardingFieldConfig<TKey extends string> = {
  key: TKey;
  label: string;
  required: boolean;
  helpText?: string;
};

export function getBusinessDetailsFields(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';
  const registrationLabel = country === 'CH'
    ? 'Ticaret sicili / UID numarası'
    : 'Ticari veya vergi kayıt numarası';

  return {
    legalReviewNote:
      'Bu alan adları taslak niteliğindedir. Ülkeye özgü hukuki ve vergisel metinler yayına alınmadan önce incelenmelidir.',
    fields: [
      {
        key: 'registrationNumber',
        label: registrationLabel,
        required: true,
        helpText: 'Başvuru taslağı kontrolünde kullanılır. Henüz gerçek bir kurum sorgulaması yapılmaz.',
      },
      {
        key: 'registeredBusinessName',
        label: 'Kayıtlı işletme unvanı',
        required: true,
      },
      {
        key: 'legalForm',
        label: 'Hukuki yapı / şirket türü',
        required: false,
      },
      {
        key: 'taxNumber',
        label: country === 'CH' ? 'Vergi / UID referansı' : 'Vergi numarası',
        required: false,
      },
      {
        key: 'vatNumber',
        label: country === 'CH' ? 'KDV / MWST numarası' : 'KDV numarası',
        required: false,
      },
      {
        key: 'registrationCountry',
        label: 'Kayıt ülkesi',
        required: true,
      },
      {
        key: 'registeredAddress',
        label: 'Kayıtlı adres',
        required: true,
      },
    ] satisfies BusinessDetailsFieldConfig[],
  };
}

export function getAuthorizedPersonFields(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';

  return {
    guidance:
      'Şahıs işletmesiyseniz kendi bilgilerinizi girin. Şirket adına başvuruyorsanız yetkili temsilci veya imza yetkilisinin bilgilerini girin.',
    legalReviewNote:
      'Bu alan adları taslak niteliğindedir. Ülkeye özgü kimlik ve imza yetkisi metinleri yayına alınmadan önce incelenmelidir.',
    fields: [
      {
        key: 'fullName',
        label: 'Ad soyad',
        required: true,
      },
      {
        key: 'email',
        label: 'İletişim e-postası',
        required: true,
      },
      {
        key: 'phoneNumber',
        label: 'İletişim telefonu',
        required: true,
      },
      {
        key: 'roleTitle',
        label: country === 'CH' ? 'Görev / imza yetkisi' : 'Görev / unvan',
        required: false,
        helpText: 'Örnek: işletme sahibi, müdür, yetkili temsilci.',
      },
      {
        key: 'ownershipPercentage',
        label: 'Sahiplik payı',
        required: false,
        helpText: 'İsteğe bağlı taslak alandır; ileride ülke paketine göre zorunlu olabilir.',
      },
    ] satisfies AuthorizedPersonFieldConfig[],
  };
}

export function getBankDetailsFields(countryPack?: TenantOnboardingCountryPack) {
  const currency = countryPack?.currency ?? 'CHF';

  return {
    helperText:
      'Bu hesap, başvuru sırasında ödeme alımı kurulumu için kullanılır. Henüz banka sağlayıcısı üzerinden gerçek doğrulama yapılmaz.',
    fields: [
      { key: 'bankName', label: 'Banka adı', required: true },
      { key: 'accountHolderName', label: 'Hesap sahibi adı', required: true },
      {
        key: 'iban',
        label: 'IBAN',
        required: true,
        helpText: 'Yalnızca temel IBAN biçimi kontrol edilir. Ülkeye özgü banka kuralları ileride ülke paketinden gelecektir.',
      },
      { key: 'currency', label: 'Para birimi', required: true, helpText: `Varsayılan ödeme para birimi: ${currency}` },
    ] satisfies OnboardingFieldConfig<BankDetailsFieldKey>[],
  };
}

export function getBillingAddressFields() {
  return {
    helperText:
      'Bu adres fatura ve faturalama kayıtları için kullanılır. Fiziksel işletme adresinden farklı olabilir.',
    fields: [
      { key: 'useBusinessAddress', label: 'İşletme adresini kullan', required: false },
      { key: 'billingName', label: 'Fatura adı / şirket unvanı', required: true },
      { key: 'country', label: 'Ülke', required: true },
      { key: 'city', label: 'Şehir / kanton / bölge', required: true },
      { key: 'postalCode', label: 'Posta kodu', required: true },
      { key: 'addressLine1', label: 'Adres satırı 1', required: true },
      { key: 'addressLine2', label: 'Adres satırı 2', required: false },
    ] satisfies OnboardingFieldConfig<BillingAddressFieldKey>[],
  };
}

export function getPlanSelectionCopy(countryPack?: TenantOnboardingCountryPack) {
  const currency = countryPack?.currency ?? 'CHF';

  return {
    title: 'Planınızı seçin',
    helperText: 'İncelemeye göndermek istediğiniz hizmet paketini seçin.',
    disclaimer:
      'Plan fiyatı ve komisyon metinleri yapılandırılabilir taslak içeriktir. Yayına alınmadan önce ülke ve sözleşme incelemesi gereklidir.',
    currency,
  };
}

export function getReviewCopy(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';

  return {
    title: 'Başvurunuzu kontrol edin',
    helperText: 'Başvurunuzu incelemeye göndermeden önce kaydedilen bilgileri kontrol edin.',
    submitLabel: 'Başvuruyu gönder',
    missingText: 'Göndermeden önce kalan zorunlu alanları tamamlayın.',
    countryNote:
      country === 'CH'
        ? 'Ülkeye özgü hukuki metinler inceleme bekleyen taslak içeriktir.'
        : 'Hukuki metinler ülke incelemesi bekleyen taslak içeriktir.',
  };
}

export function getOperationsCopy(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';

  return {
    title: 'Operasyon bilgileri',
    helperText: 'Belgelerden ve son gönderimden önce gerekli temel operasyon bilgilerini ekleyin.',
    note:
      country === 'CH'
        ? 'Operasyon gereksinimleri İsviçre başvurusu için taslak yapılandırmadır ve ülke paketiyle geliştirilecektir.'
        : 'Operasyon gereksinimleri seçilen ülke paketine göre geliştirilecektir.',
    deliveryModels: [
      { value: 'platform_fleet', label: 'Pazaryeri teslimat desteği' },
      { value: 'own_fleet', label: 'Kendi teslimat operasyonum' },
      { value: 'pickup_only', label: 'Yalnızca gel-al' },
    ],
  };
}

export function getSubmittedCopy() {
  return {
    title: 'Başvurunuz gönderildi',
    body: 'Başvurunuz alındı ve incelemeye hazır. Durumu değiştiğinde sizi bilgilendireceğiz.',
    note: 'İnceleme süresi ve olası ek gereksinimler başvuru değerlendirme sürecine bağlıdır.',
  };
}

export function getDocumentsVerificationCopy(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';

  return {
    title: 'Belgeler ve doğrulama',
    helperText: 'Başvurunun incelemeye gönderilebilmesi için en az bir güncel zorunlu belge yükleyin.',
    countryNote:
      country === 'CH'
        ? 'Belge kategorileri ve onay metinleri İsviçre özelindeki incelemeyi bekleyen taslak yapılandırmadır.'
        : 'Belge kategorileri ve onay metinleri seçilen ülke paketine göre yapılandırılacaktır.',
    requirement: 'En az bir güncel zorunlu belge',
    reviewNote:
      'Yüklenen belgeler incelemeye tabidir. Onay kayıtları başvuru kontrol adımında alınır.',
  };
}
