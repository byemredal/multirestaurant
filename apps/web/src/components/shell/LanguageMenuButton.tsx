"use client";

import { useEffect, useRef, useState } from "react";
import { LocaleFlag } from "@locales/flags";
import { useWebLanguage } from "@/lib/i18n/WebLanguageProvider";

type LocaleCode = "DE" | "EN" | "FR" | "IT" | "TR";

const localeOptions = [
    { code: "DE" as const, name: "Deutsch" },
    { code: "EN" as const, name: "English" },
    { code: "FR" as const, name: "Français" },
    { code: "IT" as const, name: "Italiano" },
    { code: "TR" as const, name: "Türkçe" },
];

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            aria-hidden="true"
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export default function LanguageMenuButton() {
    const { locale, setLocale, t } = useWebLanguage();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const activeLocale = localeOptions.find((item) => item.code === locale) ?? localeOptions[0];

    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={`${t("header.language", "Language")}: ${activeLocale.name}`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-200 bg-white px-3 text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
                onClick={() => setOpen((current) => !current)}
                type="button"
            >
                <LocaleFlag code={activeLocale.code} />
                <span className="text-[12.5px] font-semibold tracking-wide">{activeLocale.code}</span>
                <ChevronIcon open={open} />
            </button>

            {open ? (
                <div
                    className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[220px] overflow-hidden rounded-2xl border border-ink-100 bg-white p-1.5 shadow-pop"
                    role="menu"
                >
                    <div className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                        {t("header.language", "Language")}
                    </div>
                    <div className="grid gap-0.5">
                        {localeOptions.map((language) => {
                            const selected = language.code === locale;

                            return (
                                <button
                                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition ${
                                        selected
                                            ? "bg-primary-50 text-primary-700"
                                            : "text-ink-800 hover:bg-ink-50"
                                    }`}
                                    key={language.code}
                                    onClick={() => {
                                        setLocale(language.code as LocaleCode);
                                        setOpen(false);
                                    }}
                                    role="menuitem"
                                    type="button"
                                >
                                    <span className="flex items-center gap-3">
                                        <LocaleFlag code={language.code} />
                                        <span>{language.name}</span>
                                    </span>
                                    <span className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] ${selected ? 'text-primary-700' : 'text-ink-400'}`}>
                                        {language.code}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
