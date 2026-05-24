"use client";

import Link from "next/link";
import { PlatformLogo } from "@lieferzonen/ui";
import { useWebLanguage } from "@/lib/i18n/WebLanguageProvider";
import { apiBaseUrl } from "@/lib/config";
import LanguageMenuButton from "./LanguageMenuButton";

type FulfillmentMode = "delivery" | "collection";

type CustomizeHeaderProps = {
    activeRegion?: string | null;
    onBackHome?: () => void;
    onOpenRegionModal?: () => void;
    fulfillmentMode?: FulfillmentMode;
    onFulfillmentModeChange?: (mode: FulfillmentMode) => void;
};

function BackIcon() {
    return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
        </svg>
    )
}

function PinIcon() {
    return (
        <svg aria-hidden="true" className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z" />
            <circle cx="12" cy="11" r="2.5" />
        </svg>
    )
}

function DeliveryIcon() {
    return (
        <svg aria-hidden="true" className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
            <path d="M3 17V8h11v9" />
            <path d="M14 10h4l3 4v3h-2" />
        </svg>
    )
}

function CollectionIcon() {
    return (
        <svg aria-hidden="true" className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10h16" />
            <path d="M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
            <path d="M5 10v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
            <path d="M10 14h4" />
        </svg>
    )
}

function GridIcon() {
    return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <rect x="4" y="4" width="6" height="6" />
            <rect x="14" y="4" width="6" height="6" />
            <rect x="4" y="14" width="6" height="6" />
            <rect x="14" y="14" width="6" height="6" />
        </svg>
    )
}

function CourierIcon() {
    return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
            <path d="M5 18H3V8h11v10" />
            <path d="M14 10h4l3 4v4h-2" />
            <path d="M14 14h7" />
        </svg>
    )
}

function StoreIcon() {
    return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10h16" />
            <path d="M6 10V6.8C6 5.8 6.8 5 7.8 5h8.4C17.2 5 18 5.8 18 6.8V10" />
            <path d="M5 10v8a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1v-8" />
        </svg>
    )
}

function UserIcon() {
    return (
        <svg aria-hidden="true" className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 19c1.8-3 4.3-4.5 7-4.5S17.2 16 19 19" />
        </svg>
    )
}

function MenuIcon() {
    return (
        <svg aria-hidden="true" className="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
        </svg>
    )
}

const CustomizeHeader = ({
    activeRegion,
    onBackHome,
    onOpenRegionModal,
    fulfillmentMode = "delivery",
    onFulfillmentModeChange,
}: CustomizeHeaderProps) => {
    const { t } = useWebLanguage();
    const hasActiveRegion = Boolean(activeRegion);

    return (
        <header
            className="sticky top-0 z-40 w-full border-b border-black/10 bg-white/95 backdrop-blur-sm"
            style={{ fontFamily: "var(--font-header)" }}
        >
            <div className="mx-auto flex min-h-[78px] max-w-[1600px] items-center gap-4 px-4 md:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                    {hasActiveRegion ? (
                        <button
                            aria-label="Back to homepage"
                            className="hidden h-9 w-9 items-center justify-center rounded-full text-[#f36805] transition hover:bg-[#fff4ea] md:flex"
                            onClick={onBackHome}
                            type="button"
                        >
                            <BackIcon />
                        </button>
                    ) : null}

                    <Link href='/' className="flex items-center no-underline">
                        <PlatformLogo apiBaseUrl={apiBaseUrl} height={36} />
                    </Link>
                </div>

                {hasActiveRegion ? (
                    <div className="mx-auto hidden items-center gap-4 lg:flex">
                        <button
                            className="inline-flex items-center gap-2 rounded-full bg-[#f7f2eb] px-5 py-3 text-[15px] font-semibold text-[#16202a] transition hover:bg-[#f2ebe2]"
                            onClick={onOpenRegionModal}
                            type="button"
                        >
                            <span className="text-[#f36805]">
                                <PinIcon />
                            </span>
                            <span>{activeRegion}</span>
                        </button>

                        <div className="relative flex h-[46px] w-[266px] items-center rounded-full bg-[#ebe6df] p-1 text-[15px] font-semibold text-[#16202a]">
                            <span
                                aria-hidden="true"
                                className={`absolute top-1 h-[38px] w-[calc(50%-4px)] rounded-full bg-white shadow-[0_2px_10px_rgba(22,32,42,0.12)] transition-transform duration-300 ${
                                    fulfillmentMode === "delivery" ? "translate-x-0" : "translate-x-[calc(100%+4px)]"
                                }`}
                            />

                            <button
                                className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 transition ${
                                    fulfillmentMode === "delivery" ? "text-[#16202a]" : "text-[#4b4b4b]"
                                }`}
                                onClick={() => onFulfillmentModeChange?.("delivery")}
                                type="button"
                            >
                                <span className="text-[#f36805]">
                                    <DeliveryIcon />
                                </span>
                                <span>{t("header.delivery", "Delivery")}</span>
                            </button>

                            <button
                                className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 transition ${
                                    fulfillmentMode === "collection" ? "text-[#16202a]" : "text-[#4b4b4b]"
                                }`}
                                onClick={() => onFulfillmentModeChange?.("collection")}
                                type="button"
                            >
                                <span className="text-[#16202a]">
                                    <CollectionIcon />
                                </span>
                                <span>{t("header.collection", "Collection")}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <nav className="ml-auto hidden items-center gap-10 text-[15px] font-semibold text-[#16202a] lg:flex">
                        <a href="#" className="flex items-center gap-2 no-underline">
                            <GridIcon />
                            <span>{t("header.corporateOrdering", "Corporate Ordering")}</span>
                        </a>
                        <a href="#" className="flex items-center gap-2 no-underline">
                            <CourierIcon />
                            <span>{t("header.becomeCourier", "Become a courier")}</span>
                        </a>
                        <a href="#" className="flex items-center gap-2 no-underline">
                            <StoreIcon />
                            <span>{t("header.partnerWithUs", "Partner with us")}</span>
                        </a>
                    </nav>
                )}

                <div className={`${hasActiveRegion ? "ml-auto" : "ml-8"} flex items-center gap-4 md:gap-6 text-[15px] font-semibold text-[#16202a]`}>
                    {!hasActiveRegion ? (
                        <a href="#" className="hidden items-center gap-2 no-underline md:flex">
                            <UserIcon />
                            <span>{t("header.logIn", "Log in")}</span>
                        </a>
                    ) : null}

                    <LanguageMenuButton />

                    <button
                        aria-label="Open menu"
                        className="flex items-center justify-center text-[#16202a]"
                        type="button"
                    >
                        <MenuIcon />
                    </button>
                </div>
            </div>
        </header>
    )
}

export default CustomizeHeader;
