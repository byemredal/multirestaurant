export const defaultLocale = "DE" as const;
export const localeStorageKey = "lz-ui-language";

export const localeOptions = [
  { code: "DE", name: "Deutsch", flag: "🇩🇪", htmlLang: "de" },
  { code: "EN", name: "English", flag: "🇬🇧", htmlLang: "en" },
  { code: "FR", name: "Français", flag: "🇫🇷", htmlLang: "fr" },
  { code: "IT", name: "Italiano", flag: "🇮🇹", htmlLang: "it" },
  { code: "TR", name: "Türkçe", flag: "🇹🇷", htmlLang: "tr" },
] as const;

export type LocaleCode = (typeof localeOptions)[number]["code"];
export type LocaleOption = (typeof localeOptions)[number];

export function getLocaleByCode(code: string): LocaleOption {
  return localeOptions.find((locale) => locale.code === code) ?? localeOptions[0];
}

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return Boolean(value && localeOptions.some((locale) => locale.code === value));
}
