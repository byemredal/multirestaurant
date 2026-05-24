"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { PlatformLogo, Button, Avatar } from "@lieferzonen/ui";

import AuthModal from "@/components/auth/AuthModal";
import { apiBaseUrl } from "@/lib/config";
import {
    beginSocialAuth,
    bootstrapAuthSession,
    loginCustomer,
    logoutCustomer,
    registerCustomer,
    type AuthMode,
    type SocialProvider,
} from "@/lib/auth-client";
import type { FulfillmentMode } from "@/lib/home-discovery";
import type { StoredAuthSession } from "@/lib/storage/auth-session";
import { clearAuthSession, readAuthSession, writeAuthSession } from "@/lib/storage/auth-session";
import { reportTelemetry } from "@/lib/telemetry";
import { useWebLanguage } from "@/lib/i18n/WebLanguageProvider";
import { useCart } from "@/lib/cart/cart-context";
import AccountMenuModal from "./AccountMenuModal";
import LanguageMenuButton from "./LanguageMenuButton";

type HomeHeaderProps = {
    activeRegionLabel?: string | null;
    onBackHome?: () => void;
    onOpenRegionModal?: () => void;
    fulfillmentMode?: FulfillmentMode;
    onFulfillmentModeChange?: (mode: FulfillmentMode) => void;
    authEntryMode?: "modal" | "page";
    loginPath?: string;
    signupPath?: string;
};

function Icon({
    children,
    className = "h-[18px] w-[18px]",
    viewBox = "0 0 24 24",
}: {
    children: ReactNode;
    className?: string;
    viewBox?: string;
}) {
    return (
        <svg aria-hidden="true" className={className} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {children}
        </svg>
    );
}

function PinIcon() {
    return <Icon className="h-[15px] w-[15px]"><path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z" /><circle cx="12" cy="11" r="2.5" /></Icon>;
}

function DeliveryIcon() {
    return <Icon className="h-[16px] w-[16px]"><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M3 17V8h11v9" /><path d="M14 10h4l3 4v3h-2" /></Icon>;
}

function CollectionIcon() {
    return <Icon className="h-[16px] w-[16px]"><path d="M4 10h16" /><path d="M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" /><path d="M5 10v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" /><path d="M10 14h4" /></Icon>;
}

function MenuIcon() {
    return <Icon className="h-[22px] w-[22px]"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Icon>;
}

function BackIcon() {
    return <Icon className="h-[18px] w-[18px]"><path d="M15 18l-6-6 6-6" /></Icon>;
}

function GridIcon() {
    return <Icon className="h-[18px] w-[18px]"><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></Icon>;
}

function CourierIcon() {
    return <Icon className="h-[18px] w-[18px]"><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M5 18H3V8h11v10" /><path d="M14 10h4l3 4v4h-2" /><path d="M14 14h7" /></Icon>;
}

function StoreIcon() {
    return <Icon className="h-[18px] w-[18px]"><path d="M4 10h16" /><path d="M6 10V6.8C6 5.8 6.8 5 7.8 5h8.4C17.2 5 18 5.8 18 6.8V10" /><path d="M5 10v8a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1v-8" /></Icon>;
}

function UserIcon() {
    return <Icon className="h-[18px] w-[18px]"><circle cx="12" cy="8" r="3.5" /><path d="M5 19c1.8-3 4.3-4.5 7-4.5S17.2 16 19 19" /></Icon>;
}

const topLinks = [
    { key: "header.corporateOrdering", fallback: "Kurumsal", href: "/" },
    // { key: "header.becomeCourier", fallback: "Kurye ol", href: "/" },
    { key: "header.partnerWithUs", fallback: "Partner Ol", href: "http://localhost:3060/" },
];

export default function HomeHeader({
    activeRegionLabel,
    onBackHome,
    onOpenRegionModal,
    fulfillmentMode = "delivery",
    onFulfillmentModeChange,
    authEntryMode = "modal",
    loginPath = "/login",
    signupPath = "/signup",
}: HomeHeaderProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useWebLanguage();
    const { totalItems, openCart } = useCart();
    const hasActiveRegion = Boolean(activeRegionLabel);
    const [menuOpen, setMenuOpen] = useState(false);
    const [authModalMode, setAuthModalMode] = useState<AuthMode | null>(null);
    const [authSession, setAuthSession] = useState<StoredAuthSession | null>(null);
    // SSR ve ilk client render'ı aynı tutmak için: localStorage yalnızca
    // mount sonrası okunabilir. `authResolved` false iken auth slotunda
    // yanlış bir durum (giriş yap / kayıt ol) değil, nötr bir iskelet gösterilir.
    const [authResolved, setAuthResolved] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const storedSession = readAuthSession();
        if (!storedSession) {
            setAuthResolved(true);
            return;
        }

        // Saklı oturumu hemen göster (optimistic) — flash yok.
        setAuthSession(storedSession);
        setAuthResolved(true);

        const bootstrap = async () => {
            try {
                const nextSession = await bootstrapAuthSession(storedSession);
                if (cancelled) return;
                writeAuthSession(nextSession);
                setAuthSession(nextSession);
            } catch {
                if (cancelled) return;
                clearAuthSession();
                setAuthSession(null);
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, []);

    const signedIn = useMemo(() => Boolean(authSession?.account.id), [authSession]);
    const userName = useMemo(
        () => authSession ? `${authSession.account.firstName} ${authSession.account.lastName}`.trim() : null,
        [authSession],
    );
    const firstName = useMemo(
        () => authSession?.account.firstName?.trim() || null,
        [authSession],
    );
    const userInitials = useMemo(() => {
        if (!authSession) return "";
        const a = authSession.account.firstName?.[0] ?? "";
        const b = authSession.account.lastName?.[0] ?? "";
        return (a + b).toUpperCase() || "LZ";
    }, [authSession]);

    const openMenu = useCallback(() => {
        setMenuOpen(true);
    }, []);

    const logout = useCallback(async () => {
        if (authSession) {
            void logoutCustomer(authSession);
            void reportTelemetry({
                type: "auth_logout",
                payload: { accountId: authSession.account.id },
            });
        }
        clearAuthSession();
        setAuthSession(null);
        setMenuOpen(false);
    }, [authSession]);

    const openAuth = useCallback(
        (mode: AuthMode) => {
            setMenuOpen(false);
            if (authEntryMode === "page") {
                const targetPath = mode === "login" ? loginPath : signupPath;
                const query = pathname ? `?returnTo=${encodeURIComponent(pathname)}` : "";
                router.push(`${targetPath}${query}`);
                return;
            }
            setAuthModalMode(mode);
        },
        [authEntryMode, loginPath, signupPath, pathname, router],
    );

    const closeMenu = useCallback(() => setMenuOpen(false), []);
    const closeAuthModal = useCallback(() => setAuthModalMode(null), []);

    const handleSocialAuth = useCallback(
        async (provider: SocialProvider, mode: AuthMode) => {
            await beginSocialAuth(provider, mode, pathname ?? "/");
        },
        [pathname],
    );

    const handleAuthSubmit = useCallback(
        async ({
            mode,
            firstName: f,
            lastName,
            email,
            password,
        }: {
            mode: AuthMode;
            firstName: string;
            lastName: string;
            email: string;
            password: string;
        }) => {
            const nextSession =
                mode === "login"
                    ? await loginCustomer(email, password)
                    : await registerCustomer(f, lastName, email, password);

            writeAuthSession(nextSession);
            setAuthSession(nextSession);
            void reportTelemetry({
                type: mode === "login" ? "auth_login_success" : "auth_register_success",
                payload: { accountId: nextSession.account.id, source: "auth_modal" },
            });
        },
        [],
    );

    return (
        <>
            <header className="sticky top-0 z-40 w-full border-b border-ink-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75">
                <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
                    {/* ── Brand block ─────────────────────────────────── */}
                    <div className="flex min-w-0 items-center gap-2.5">
                        {hasActiveRegion ? (
                            <button
                                aria-label="Ana sayfaya dön"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-ink-100 hover:text-ink-900"
                                onClick={onBackHome}
                                type="button"
                            >
                                <BackIcon />
                            </button>
                        ) : null}

                        <Link href="/" className="flex items-center gap-2" aria-label="Ana sayfa">
                            <PlatformLogo apiBaseUrl={apiBaseUrl} height={28} />
                        </Link>
                    </div>

                    {/* ── Center: nav OR region+mode segment ─────────── */}
                    {hasActiveRegion ? (
                        <div className="mx-auto hidden items-center gap-2 lg:flex">
                            <button
                                className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-200 bg-white px-4 text-[13.5px] font-semibold text-ink-900 transition hover:border-ink-300 hover:bg-ink-50"
                                onClick={onOpenRegionModal}
                                type="button"
                            >
                                <span className="text-primary-700"><PinIcon /></span>
                                <span className="max-w-[220px] truncate">{activeRegionLabel}</span>
                                <span aria-hidden className="text-ink-400">▾</span>
                            </button>

                            {/* Mode segment — same 40px height, proportional */}
                            <div className="relative inline-flex h-10 rounded-full bg-ink-100 p-1">
                                <span
                                    aria-hidden="true"
                                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white shadow-card transition-transform duration-300 ${fulfillmentMode === "delivery" ? "translate-x-0" : "translate-x-[calc(100%+4px)]"
                                        }`}
                                />
                                <button
                                    className={`relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition ${fulfillmentMode === "delivery" ? "text-ink-900" : "text-ink-500 hover:text-ink-800"
                                        }`}
                                    onClick={() => onFulfillmentModeChange?.("delivery")}
                                    type="button"
                                    aria-pressed={fulfillmentMode === "delivery"}
                                >
                                    <DeliveryIcon />
                                    <span>{t("header.delivery", "Teslimat")}</span>
                                </button>
                                <button
                                    className={`relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition ${fulfillmentMode === "collection" ? "text-ink-900" : "text-ink-500 hover:text-ink-800"
                                        }`}
                                    onClick={() => onFulfillmentModeChange?.("collection")}
                                    type="button"
                                    aria-pressed={fulfillmentMode === "collection"}
                                >
                                    <CollectionIcon />
                                    <span>{t("header.collection", "Gel-al")}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <nav aria-label="Primary" className="mx-auto hidden items-center gap-1 lg:flex">
                            {topLinks.map((link) => (
                                <Link
                                    key={link.key}
                                    href={link.href}
                                    className="inline-flex h-10 items-center rounded-full px-3.5 text-[13.5px] font-medium text-ink-700 transition hover:bg-ink-100 hover:text-ink-900"
                                >
                                    {t(link.key, link.fallback)}
                                </Link>
                            ))}
                        </nav>
                    )}

                    {/* ── Action cluster (right) ─────────────────────── */}
                    <div className="ml-auto flex items-center gap-2">
                        {/* Cart */}
                        <button
                            aria-label={totalItems > 0 ? `Sepeti aç — ${totalItems} ürün` : "Sepeti aç"}
                            onClick={openCart}
                            type="button"
                            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-800 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                            <svg
                                aria-hidden="true"
                                className="h-[18px] w-[18px]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                                <path d="M3 6h18" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                            {totalItems > 0 && (
                                <span
                                    aria-hidden
                                    className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-white"
                                >
                                    {totalItems > 9 ? "9+" : totalItems}
                                </span>
                            )}
                        </button>

                        {/* Language */}
                        <LanguageMenuButton />

                        {/* Divider — only between action cluster and auth */}
                        <span aria-hidden className="mx-1 hidden h-6 w-px bg-ink-200 md:block" />

                        {/* Auth slot — 3 durum: çözülmedi (iskelet) / üye / misafir */}
                        {!authResolved ? (
                            /* Nötr iskelet: SSR + ilk client render ile birebir aynı.
                               Yanlış durum gösterilmez, yalnızca yer tutulur. */
                            <div aria-hidden className="flex items-center gap-2">
                                <span className="hidden h-10 w-[88px] animate-pulse rounded-full bg-ink-100 md:block" />
                                <span className="h-10 w-10 animate-pulse rounded-full bg-ink-100 md:hidden" />
                            </div>
                        ) : signedIn ? (
                            <Button
                                type="button"
                                onClick={openMenu}
                                aria-label={`Hesap menüsü — ${userName ?? ''}`}
                                className="flex flex-row items-center gap-2"
                                leftIcon={
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                                        <Avatar status='online' rounded="md" size='xs' name={userName ?? undefined} />
                                    </span>
                                }
                                shimmer={true}
                                rounded="full"
                            >
                                <span className="hidden max-w-[120px] truncate md:inline">{firstName ?? 'Hesabım'}</span>
                            </Button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => openAuth("login")}
                                    className="hidden h-10 items-center justify-center rounded-full px-4 text-[13.5px] font-semibold text-ink-800 transition hover:bg-ink-100 md:inline-flex"
                                >
                                    {t("header.logIn", "Giriş yap")}
                                </button>
                                <Button
                                    type="button"
                                    onClick={() => openAuth("signup")}
                                    shimmer={true}
                                    className="hidden h-10 items-center justify-center rounded-full bg-primary px-4 text-[13.5px] font-semibold text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:inline-flex"
                                >
                                    {t("header.signUp", "Hesap aç")}
                                </Button>
                                {/* Mobil: iki butonun yerine tek dokunma hedefi */}
                                <button
                                    aria-label="Giriş yap"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-800 transition hover:border-ink-300 hover:bg-ink-50 md:hidden"
                                    onClick={() => openAuth("login")}
                                    type="button"
                                >
                                    <UserIcon />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>
            {menuOpen ? (
                <AccountMenuModal
                    authSession={authSession}
                    onClose={closeMenu}
                    onLogout={logout}
                    onOpenAuth={openAuth}
                />
            ) : null}

            {authModalMode ? (
                <AuthModal
                    initialMode={authModalMode}
                    onClose={closeAuthModal}
                    onSocialAuth={handleSocialAuth}
                    onSubmit={handleAuthSubmit}
                />
            ) : null}
        </>
    );
}
