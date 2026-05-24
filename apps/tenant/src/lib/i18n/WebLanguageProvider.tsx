"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultLocale, getLocaleByCode, isLocaleCode, localeStorageKey, type LocaleCode } from "@locales/core";
import { buildNextIntlMessages, hasFlatMessage } from "@locales/next-intl";
import { webMessages as tenantMessages } from "@locales/tenant";

type LanguageContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  messages: Record<string, string>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function WebLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<LocaleCode>(defaultLocale);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedLocale = window.localStorage.getItem(localeStorageKey);
    if (isLocaleCode(storedLocale)) {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(localeStorageKey, locale);
    const localeMeta = getLocaleByCode(locale);
    document.documentElement.lang = localeMeta.htmlLang;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const selectedMessages = tenantMessages[locale] ?? tenantMessages[defaultLocale];
  const intlMessages = useMemo(() => buildNextIntlMessages(selectedMessages), [selectedMessages]);
  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      messages: selectedMessages,
    }),
    [locale, selectedMessages],
  );

  return (
    <LanguageContext.Provider value={value}>
      <NextIntlClientProvider locale={getLocaleByCode(locale).htmlLang} messages={intlMessages}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export function useWebLanguage() {
  const context = useContext(LanguageContext);
  const tIntl = useTranslations();

  if (!context) {
    throw new Error("useWebLanguage must be used inside WebLanguageProvider.");
  }

  return {
    locale: context.locale,
    setLocale: context.setLocale,
    t: (key: string, fallback?: string) =>
      hasFlatMessage(context.messages, key) ? tIntl(key) : (fallback ?? key),
  };
}
