'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button } from '@lieferzonen/ui';
import { Input } from '@lieferzonen/ui';
import { Select } from '@lieferzonen/ui';
import { PlatformLogo, usePlatformBranding } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { useRouter } from 'next/navigation';
import { apiBaseUrl } from '@/lib/http/tenant-http';
import { usePlatformPack } from '@/lib/platform-pack-context';
import { AddressAutocomplete, type AddressSuggestion } from '@/components/tenant/AddressAutocomplete';
import {
  getTenantOnboardingWorkspaceByStateToken,
  startTenantOnboarding,
} from '@/lib/tenant-onboarding-client';
import { TenantWaitingScreen } from '@/components/tenant/TenantWaitingScreen';
import {
  clearOnboardingStateToken,
  readOnboardingStateToken,
  writeOnboardingStateToken,
} from '@/lib/storage/tenant-session';
import {
  getTenantOnboardingResumeUrl,
  getTenantOnboardingStepUrl,
} from '@/components/tenant/onboarding/onboarding-routing';

/* ── Free-license imagery (Unsplash) ──────────────────────────────────── */
const IMG_HERO =
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=80';
const IMG_FEATURE_ORDERS =
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80';
const IMG_FEATURE_KITCHEN =
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80';
const IMG_FEATURE_DELIVERY =
  'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80';
const IMG_STEPS =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';
const IMG_DARK_BAND =
  'https://images.unsplash.com/photo-1559329007-40df8a9345d8?auto=format&fit=crop&w=1600&q=80';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const FAQ_ITEMS: Array<[string, string]> = [
  ['Kimler başvurabilir?', 'Restoranlar, fırınlar, marketler ve yerel yiyecek konseptleri doğrudan başvurabilir.'],
  ['Hangi belgeler gerekli?', 'İşletme adı, adres ve sahip iletişim bilgileri yeterli; ayrıntılı belge yüklemeleri onboarding sırasında istenir.'],
  ['Menüyü sonra düzenleyebilir miyim?', 'Evet. Aktivasyon sonrası tenant stüdyosundan restoranınızı, kategorileri ve ürünleri yönetebilirsiniz.'],
  ['Teslimat modelini değiştirebilir miyim?', 'Evet. Başlangıçta seçilen model, operasyon büyüdükçe yeniden ayarlanabilir.'],
];

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' ') || parts[0] || '',
  };
}

type FieldKey =
  | 'companyName'
  | 'companyAddress'
  | 'fullName'
  | 'email'
  | 'phoneNumber';

export default function TenantEntryPage() {
  const router = useRouter();
  const { session, status } = useTenantAuth();

  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyAddressMeta, setCompanyAddressMeta] = useState<AddressSuggestion | null>(null);
  const [tenantType, setTenantType] = useState<'food_service' | 'retail' | 'other'>('food_service');
  const [deliveryModel, setDeliveryModel] = useState<'own_fleet' | 'platform_fleet' | 'hybrid'>('platform_fleet');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [storedStateToken, setStoredStateToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const branding = usePlatformBranding(apiBaseUrl);
  const platformName = branding?.platformName?.trim() || 'Platform';
  // Active CountryPack drives the phone prefix + address-search country bias.
  // Setup not yet run → fall back to nothing (don't burn a CH default into UI).
  const platformPack = usePlatformPack();
  const dialCode = platformPack?.phone.e164Country ?? '';
  const packCountry = platformPack?.country ?? '';

  // Stale resume token cleanup: a token in localStorage MUST be backend-validated
  // before we hint at a "resume your onboarding" affordance. Without this guard a
  // development/test artefact (or any closed-status leftover) would surface in
  // the production hero and break trust.
  useEffect(() => {
    const stored = readOnboardingStateToken();
    if (!stored) {
      return;
    }

    let cancelled = false;
    void getTenantOnboardingWorkspaceByStateToken(stored)
      .then((workspace) => {
        if (cancelled) {
          return;
        }
        const status = workspace.application.status;
        // Closed lifecycle and the no-progress draft default are NOT resume
        // candidates — drop the token so the badge stays hidden.
        const TERMINAL = new Set(['approved', 'active', 'rejected', 'suspended']);
        if (TERMINAL.has(status)) {
          clearOnboardingStateToken();
          return;
        }
        setStoredStateToken(stored);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        clearOnboardingStateToken();
        setStoredStateToken(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (session && status === 'PENDING_APPROVAL') {
    return <TenantWaitingScreen />;
  }

  const scrollToForm = () => {
    document.getElementById('tenant-register-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const continueOnboarding = async () => {
    if (!storedStateToken) {
      return;
    }

    try {
      setResumeLoading(true);
      setResumeError(null);
      const workspace = await getTenantOnboardingWorkspaceByStateToken(storedStateToken);
      writeOnboardingStateToken(workspace.stateToken);
      setStoredStateToken(workspace.stateToken);
      router.push(getTenantOnboardingResumeUrl(workspace));
    } catch {
      clearOnboardingStateToken();
      setStoredStateToken(null);
      setResumeError('Kayitli devam linki gecersiz veya suresi dolmus. Yeni basvuru baslatabilirsiniz.');
    } finally {
      setResumeLoading(false);
    }
  };

  const clearField = (key: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): Partial<Record<FieldKey, string>> => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!companyName.trim()) errors.companyName = 'Şirket adı zorunludur.';
    else if (companyName.trim().length < 2) errors.companyName = 'Şirket adı en az 2 karakter olmalı.';

    if (!companyAddress.trim()) errors.companyAddress = 'Şirket adresi zorunludur.';
    else if (companyAddress.trim().length < 5) errors.companyAddress = 'Adres en az 5 karakter olmalı.';

    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    if (!fullName.trim()) errors.fullName = 'Ad Soyad zorunludur.';
    else if (nameParts.length < 2) errors.fullName = 'Lütfen hem ad hem soyad girin.';

    if (!email.trim()) errors.email = 'E-posta zorunludur.';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Geçerli bir e-posta adresi girin.';

    const phoneDigits = phoneNumber.replace(/[^\d]/g, '');
    if (!phoneNumber.trim()) errors.phoneNumber = 'Telefon numarası zorunludur.';
    else if (phoneDigits.length < 7 || phoneDigits.length > 14) errors.phoneNumber = 'Telefon numarası 7-14 hane arası olmalı.';

    return errors;
  };

  const join = async () => {
    setError(null);
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Lütfen formdaki hataları düzeltin.');
      scrollToForm();
      return;
    }
    setFieldErrors({});

    if (!acceptedTerms) {
      setError('Devam etmek için Kullanım Şartları ve Gizlilik Politikası onayını işaretleyin.');
      scrollToForm();
      return;
    }

    if (!dialCode) {
      setError('Platform yapılandırması yüklenemedi. Lütfen sayfayı yenileyin.');
      return;
    }

    try {
      setLoading(true);
      const { firstName, lastName } = splitName(fullName);
      const normalizedPhoneNumber = `${dialCode}${phoneNumber.replace(/[^\d]/g, '')}`;

      // The user may have typed the address without selecting a suggestion;
      // when they did select, the meta captured at that moment matches the
      // label currently in the input. Forward meta only when both still align
      // — otherwise fall back to a `provider: 'manual'` payload so backend
      // attribution stays honest.
      const trimmedAddress = companyAddress.trim();
      const addressMeta =
        companyAddressMeta && companyAddressMeta.label.trim() === trimmedAddress
          ? {
              label: companyAddressMeta.label,
              city: companyAddressMeta.city ?? null,
              postalCode: companyAddressMeta.postalCode ?? null,
              countryCode: companyAddressMeta.country ?? null,
              latitude: companyAddressMeta.latitude ?? null,
              longitude: companyAddressMeta.longitude ?? null,
              provider: 'locationiq' as const,
              providerPlaceId: companyAddressMeta.id ?? null,
            }
          : trimmedAddress
            ? {
                label: trimmedAddress,
                provider: 'manual' as const,
              }
            : undefined;

      const onboarding = await startTenantOnboarding({
        firstName,
        lastName,
        email: email.trim(),
        phoneNumber: normalizedPhoneNumber,
        companyName: companyName.trim(),
        companyAddress: trimmedAddress,
        tenantType,
        deliveryModel,
        acceptedTerms: true,
        acceptedLocale: platformPack?.locale,
        addressMeta,
      });

      writeOnboardingStateToken(onboarding.stateToken);
      setStoredStateToken(onboarding.stateToken);
      router.push(getTenantOnboardingStepUrl(onboarding.stateToken, 'welcome'));
    } catch (joinError) {
      const message =
        joinError instanceof Error && joinError.message && !joinError.message.startsWith('tenant_onboarding_')
          ? joinError.message
          : 'Kayıt başarısız. Lütfen bilgilerinizi kontrol edip tekrar deneyin.';
      setError(message);
      scrollToForm();
    } finally {
      setLoading(false);
    }
  };

  const inputErrorClass = (key: FieldKey) =>
    fieldErrors[key]
      ? 'h-12 rounded-2xl border-danger-200 bg-danger-50/40 px-4 text-[15px]'
      : 'h-12 rounded-2xl border-ink-200 px-4 text-[15px]';

  return (
    <div className="min-h-screen bg-white text-ink-900">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <a href="/" className="inline-flex items-center gap-2">
            <PlatformLogo apiBaseUrl={apiBaseUrl} height={28} />
            <span className="hidden text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500 sm:inline">
              Tenants
            </span>
          </a>

          <nav aria-label="Primary" className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="inline-flex h-10 items-center justify-center rounded-full border border-ink-200 bg-white px-4 text-[13.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50 sm:px-5"
            >
              Giriş yap
            </button>
            <button
              type="button"
              onClick={scrollToForm}
              className="inline-flex h-10 items-center justify-center rounded-full bg-ink-900 px-4 text-[13.5px] font-semibold text-white transition hover:bg-ink-800 sm:px-5"
            >
              Başvuru başlat
              <span aria-hidden className="ml-1.5">→</span>
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:pb-20 lg:pt-16">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-700">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                4.8 / 5 — tenant memnuniyeti
              </span>

              <h1 className="mt-6 text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[64px]">
                Mutfağın <span className="font-italiana font-normal italic text-primary-700">akışı</span>,
                <br />
                tek bir panelde.
              </h1>

              <p className="mt-5 max-w-[520px] text-[17px] leading-[1.65] text-ink-600">
                {platformName} tenant platformu; menüden siparişe, fiyatlandırmadan kuryeye, restoran
                operasyonunu uçtan uca toparlar — dakikalar içinde canlıya çık.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  className="h-12 rounded-full px-6 text-[15px]"
                  onClick={scrollToForm}
                >
                  Ücretsiz başvur
                  <span aria-hidden className="ml-1.5">→</span>
                </Button>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-ink-200 bg-white px-6 text-[14.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
                >
                  Hesabım var
                </button>
              </div>

              <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-500">
                <li className="inline-flex items-center gap-1.5">
                  <DotCheck /> Kart bilgisi istemez
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <DotCheck /> 7 dk'da başvuru
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <DotCheck /> Komisyon şeffaf
                </li>
              </ul>

              {storedStateToken ? (
                <div className="mt-6 max-w-[560px] rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink-900">
                        Yarım kalan başvurunuza devam edin
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
                        Bu cihazda kayıtlı bir onboarding başvurusu bulundu.
                      </p>
                      {resumeError ? (
                        <p className="mt-2 text-[12.5px] leading-relaxed text-danger-700">
                          {resumeError}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      className="h-10 rounded-full px-4 text-[13.5px]"
                      disabled={resumeLoading}
                      onClick={() => void continueOnboarding()}
                    >
                      {resumeLoading ? 'Kontrol ediliyor…' : 'Devam et'}
                    </Button>
                  </div>
                </div>
              ) : resumeError ? (
                <div className="mt-6 max-w-[560px] rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
                  {resumeError}
                </div>
              ) : null}
            </div>

            {/* Hero collage */}
            <div className="relative">
              <div className="relative aspect-[5/6] w-full overflow-hidden rounded-3xl bg-ink-200 shadow-card">
                <Image
                  src={IMG_HERO}
                  alt="Şefler yoğun mutfakta servis hazırlıyor"
                  fill
                  priority
                  sizes="(min-width: 1024px) 540px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-900/60 via-ink-900/15 to-transparent" />

                {/* Floating live tag */}
                <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-ink-800 shadow-pop backdrop-blur">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Canlı sipariş akışı
                </div>

                {/* Floating mini order card */}
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/70 bg-white/95 p-3.5 shadow-pop backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                        <IconBag />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink-900">#LZ-2841 · Margherita</p>
                        <p className="truncate text-[11.5px] text-ink-500">2 ürün · Zürich</p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-warning-700">
                      Hazırlanıyor
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 rounded-full bg-ink-100">
                    <div className="h-full w-2/3 rounded-full bg-primary" />
                  </div>
                </div>
              </div>

              {/* Side stat card */}
              <div className="absolute -left-4 bottom-12 hidden w-[180px] rounded-2xl border border-ink-100 bg-white p-4 shadow-pop sm:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Bu ay</p>
                <p className="mt-1 text-[26px] font-bold tracking-[-0.02em] text-ink-900">+18%</p>
                <p className="mt-0.5 text-[11.5px] text-ink-500">Ortalama sipariş büyümesi</p>
                <div className="mt-3 flex h-9 items-end gap-1">
                  {[28, 42, 18, 56, 34, 62, 70].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}%` }}
                      className={`w-2.5 rounded-full ${i === 6 ? 'bg-primary' : 'bg-primary-100'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Subtle bottom divider */}
          <div className="mx-auto h-px max-w-[1280px] bg-gradient-to-r from-transparent via-ink-100 to-transparent" />
        </section>

        {/* ── Stat band ────────────────────────────────────────────────── */}
        <section className="bg-ink-50">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-px overflow-hidden border-x border-ink-100 bg-ink-100 sm:grid-cols-4">
            {[
              ['82%', 'Manuel iletişimde düşüş'],
              ['2-4×', 'Daha hızlı operasyon'],
              ['18%', 'Ortalama sipariş artışı'],
              ['7 dk', 'Ortalama başvuru süresi'],
            ].map(([value, label]) => (
              <div key={label} className="bg-white px-5 py-8 text-center sm:py-10">
                <p className="font-italiana text-[42px] leading-none text-ink-900 sm:text-[52px]">{value}</p>
                <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature grid (image-driven) ──────────────────────────────── */}
        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-[640px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
              Operasyon
            </p>
            <h2 className="mt-3 font-italiana text-[42px] leading-[1.04] tracking-[-0.02em] text-ink-900 sm:text-[56px]">
              Tek panel, tüm akış.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.65] text-ink-600">
              Sipariş kabulü, menü güncellemeleri, fiyatlandırma kararları ve kurye atamaları —
              aynı yerde, gecikmesiz.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                title: 'Sipariş kabul & yönetim',
                desc: 'Canlı sipariş akışı, durum geçişleri ve restoran bazlı görünüm. Hiçbir sipariş ekrandan kaçmaz.',
                img: IMG_FEATURE_ORDERS,
                alt: 'Restoran POS ekranında sipariş listesi',
              },
              {
                title: 'Menü & ürün stüdyosu',
                desc: 'Kategoriler, ürünler, opsiyonlar, fotoğraflar — anlık güncelleme, dakikalar içinde yayında.',
                img: IMG_FEATURE_KITCHEN,
                alt: 'Şef tablet üzerinde menüye fotoğraf ekliyor',
              },
              {
                title: 'Kurye & teslimat',
                desc: 'Kendi filon, platform filosu veya hibrit. Her sipariş için doğru rotayı sen seç.',
                img: IMG_FEATURE_DELIVERY,
                alt: 'Kurye motosikletle siparişi taşıyor',
              },
            ].map((card) => (
              <article
                key={card.title}
                className="group flex flex-col overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-100">
                  <Image
                    src={card.img}
                    alt={card.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-[22px] font-bold tracking-[-0.02em] text-ink-900">{card.title}</h3>
                  <p className="mt-2.5 text-[14.5px] leading-[1.65] text-ink-600">{card.desc}</p>
                  <div className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-700">
                    Daha fazla bilgi
                    <span aria-hidden>→</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Form + steps split ───────────────────────────────────────── */}
        <section className="bg-ink-50">
          <div className="mx-auto grid max-w-[1360px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,640px)] lg:gap-10 lg:px-8 lg:py-20">
            {/* Left: how to start */}
            <div className="flex flex-col">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
                Başla
              </p>
              <h2 className="mt-3 font-italiana text-[42px] leading-[1.04] tracking-[-0.02em] text-ink-900 sm:text-[56px]">
                3 adımda canlıya çık.
              </h2>
              <p className="mt-4 max-w-[480px] text-[16px] leading-[1.65] text-ink-600">
                Hesap aç, menüni hazırla, siparişleri al. Karmaşık entegrasyon yok — kayıttan
                operasyona kesintisiz akış.
              </p>

              <div className="mt-8 rounded-[8px] border border-ink-200 bg-white p-5 shadow-card">
                <PlatformLogo apiBaseUrl={apiBaseUrl} height={38} />
                <p className="mt-4 text-[14px] leading-6 text-ink-600">
                  {platformName} ekibi, basvuru boyunca telefon dogrulama, belge kontrolu ve
                  restoran aktivasyonunu ayni onboarding akisi icinde toplar.
                </p>
                <div className="mt-5 grid gap-3 text-[13px] text-ink-700">
                  {['Devam linki otomatik olusur', 'Belgeler daha sonra guvenli sekilde yuklenir', 'Onaydan sonra sifre kurulumu acilir'].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <DotCheck />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-6 aspect-[4/3] w-full overflow-hidden rounded-[8px] bg-ink-100">
                <Image
                  src={IMG_STEPS}
                  alt="Aydınlık restoran iç mekanında müşteri ve şef"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/55 via-ink-900/10 to-transparent" />
                <div className="absolute inset-x-6 bottom-6 grid gap-3 text-white sm:inset-x-8 sm:bottom-8">
                  {[
                    ['01', 'Başvur', 'İşletme bilgilerini paylaş, hesabını yarat.'],
                    ['02', 'Stüdyoyu hazırla', 'Restoran profilini ve menü ürünlerini ekle.'],
                    ['03', 'Yayına al', 'Ilk siparişler dakikalar içinde gelmeye başlasın.'],
                  ].map(([step, title, desc]) => (
                    <div
                      key={step}
                      className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur"
                    >
                      <span className="font-italiana text-[28px] leading-none text-white">{step}</span>
                      <div>
                        <p className="text-[14px] font-semibold">{title}</p>
                        <p className="mt-0.5 text-[12.5px] text-white/85">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: registration form */}
            <div
              id="tenant-register-form"
              className="rounded-[8px] border border-ink-200 bg-white p-4 shadow-card sm:p-6"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-700">
                  Başvuru formu
                </span>
              </div>
              <h2 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[32px]">
                Restoranını {platformName}{platformName.endsWith('i') ? "'ye" : "'a"} getir.
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-500">
                Sadece temel bilgiler. Belgeler ve detaylı ayarlar onboarding ekranında.
              </p>

              <div className="mt-6 grid gap-4">
                <div>
                  <label htmlFor="tenant-company-name" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                    İşletme adı <span className="text-danger-600" aria-hidden>*</span>
                  </label>
                  <Input
                    id="tenant-company-name"
                    aria-invalid={Boolean(fieldErrors.companyName)}
                    className={inputErrorClass('companyName')}
                    onChange={(e) => { setCompanyName(e.target.value); clearField('companyName'); }}
                    placeholder="ör. Bistro Vita"
                    value={companyName}
                  />
                  {fieldErrors.companyName ? (
                    <p className="mt-1 text-[12px] text-danger-700">{fieldErrors.companyName}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="tenant-company-address" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                    İşletme adresi <span className="text-danger-600" aria-hidden>*</span>
                  </label>
                  <AddressAutocomplete
                    id="tenant-company-address"
                    value={companyAddress}
                    onChange={(next) => {
                      setCompanyAddress(next);
                      clearField('companyAddress');
                      if (companyAddressMeta && next !== companyAddressMeta.label) {
                        setCompanyAddressMeta(null);
                      }
                    }}
                    onSelect={(suggestion) => setCompanyAddressMeta(suggestion)}
                    countryCode={packCountry || undefined}
                    placeholder="Adres, sokak, cadde veya posta kodu"
                    invalid={Boolean(fieldErrors.companyAddress)}
                  />
                  <p className="mt-1.5 text-[12px] text-ink-500">
                    Yazdıkça önerilen adreslerden birini seçin. Detayları onboarding adımında netleştirebilirsiniz.
                  </p>
                  {fieldErrors.companyAddress ? (
                    <p className="mt-1 text-[12px] text-danger-700">{fieldErrors.companyAddress}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="tenant-type" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                      İşletme türü
                    </label>
                    <Select
                      id="tenant-type"
                      className="h-12 rounded-2xl border-ink-200 px-4 text-[15px]"
                      onChange={(e) => setTenantType(e.target.value as 'food_service' | 'retail' | 'other')}
                      value={tenantType}
                    >
                      <option value="food_service">Yemek servisi</option>
                      <option value="retail">Perakende</option>
                      <option value="other">Diğer</option>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="tenant-delivery-model" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                      Teslimat modeli
                    </label>
                    <Select
                      id="tenant-delivery-model"
                      className="h-12 rounded-2xl border-ink-200 px-4 text-[15px]"
                      onChange={(e) => setDeliveryModel(e.target.value as 'own_fleet' | 'platform_fleet' | 'hybrid')}
                      value={deliveryModel}
                    >
                      <option value="platform_fleet">Platform filosu</option>
                      <option value="own_fleet">Kendi filom</option>
                      <option value="hybrid">Hibrit</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label htmlFor="tenant-full-name" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                    Yetkili ad soyad <span className="text-danger-600" aria-hidden>*</span>
                  </label>
                  <Input
                    id="tenant-full-name"
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    className={inputErrorClass('fullName')}
                    onChange={(e) => { setFullName(e.target.value); clearField('fullName'); }}
                    placeholder="ör. Aylin Demir"
                    value={fullName}
                  />
                  {fieldErrors.fullName ? (
                    <p className="mt-1 text-[12px] text-danger-700">{fieldErrors.fullName}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="tenant-email" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                      E-posta <span className="text-danger-600" aria-hidden>*</span>
                    </label>
                    <Input
                      id="tenant-email"
                      aria-invalid={Boolean(fieldErrors.email)}
                      className={inputErrorClass('email')}
                      onChange={(e) => { setEmail(e.target.value); clearField('email'); }}
                      placeholder="ornek@isletmeniz.com"
                      type="email"
                      value={email}
                    />
                    {fieldErrors.email ? (
                      <p className="mt-1 text-[12px] text-danger-700">{fieldErrors.email}</p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="tenant-phone" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                      Telefon <span className="text-danger-600" aria-hidden>*</span>
                    </label>
                    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                      <div
                        aria-label="Ülke kodu"
                        className="flex h-12 items-center justify-center rounded-2xl border border-ink-200 bg-ink-50 px-3 text-[14px] font-semibold text-ink-700"
                      >
                        {dialCode || '—'}
                      </div>
                      <Input
                        id="tenant-phone"
                        aria-invalid={Boolean(fieldErrors.phoneNumber)}
                        aria-describedby="tenant-phone-help"
                        className={inputErrorClass('phoneNumber')}
                        inputMode="tel"
                        autoComplete="tel-national"
                        onChange={(e) => { setPhoneNumber(e.target.value); clearField('phoneNumber'); }}
                        placeholder="79 123 45 67"
                        value={phoneNumber}
                      />
                    </div>
                    <p id="tenant-phone-help" className="mt-1 text-[12px] text-ink-500">
                      Ülke kodu platform yapılandırmasından otomatik gelir.
                    </p>
                    {fieldErrors.phoneNumber ? (
                      <p className="mt-1 text-[12px] text-danger-700">{fieldErrors.phoneNumber}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3 text-[12.5px] leading-5 text-ink-600">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                  </span>
                  <span>
                    Şifre gerekmez. Başvuruyu gönderince size özel bir{' '}
                    <strong className="font-semibold text-ink-800">devam linki</strong>{' '}
                    oluşturulur — onboarding'i istediğiniz zaman kaldığınız yerden
                    sürdürebilirsiniz. Şifrenizi başvurunuz onaylandıktan sonra
                    belirlersiniz.
                  </span>
                </div>

                <label
                  htmlFor="tenant-accept-terms"
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] leading-5 transition ${
                    acceptedTerms
                      ? 'border-primary-200 bg-primary-50/50 text-ink-700'
                      : 'border-ink-200 bg-white text-ink-600'
                  }`}
                >
                  <input
                    id="tenant-accept-terms"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-primary focus:ring-2 focus:ring-primary/30"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                  />
                  <span>
                    <strong className="font-semibold text-ink-800">Kullanım Şartları ve Gizlilik Politikası</strong>'nı okudum ve kabul ediyorum.{' '}
                    <a href="/me/legal" className="underline-offset-2 hover:underline">
                      Belgeleri görüntüle →
                    </a>
                  </span>
                </label>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-[13.5px] text-danger-700"
                >
                  {error}
                </div>
              ) : null}

              <Button
                className="mt-6 h-12 w-full rounded-full text-[15px]"
                disabled={loading || !acceptedTerms || !dialCode}
                onClick={join}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    Başvuru gönderiliyor…
                  </span>
                ) : (
                  'Başvuruyu gönder'
                )}
              </Button>

              {!dialCode ? (
                <p className="mt-3 text-[12px] text-ink-500">
                  Platform yapılandırması yükleniyor… Form birkaç saniye içinde aktif olacak.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Dark band: marketplace pitch ─────────────────────────────── */}
        <section className="relative overflow-hidden bg-ink-900 text-white">
          <div className="absolute inset-0">
            <Image
              src={IMG_DARK_BAND}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-ink-900/70" />
          </div>
          <div className="relative mx-auto grid max-w-[1280px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Neden {platformName}
              </span>
              <h2 className="mt-5 font-italiana text-[40px] leading-[1.06] tracking-[-0.02em] sm:text-[54px]">
                Yerel marka, modern teknoloji.
              </h2>
              <p className="mt-5 max-w-[540px] text-[16px] leading-[1.7] text-white/80">
                {platformName}, restoran sahiplerinin kendi vitrinlerini kurabildiği ve gerçek zamanlı
                operasyon yürütebildiği bir pazar yeri. Şeffaf komisyon, hızlı destek, kuryelerinle
                ya da bizim filomuzla teslim — kuralları sen koy.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Şeffaf komisyon, sürpriz kesinti yok',
                  'Türkçe destek, hafta içi hızlı yanıt',
                  'Kendi filo, platform filosu veya hibrit',
                  'POS / Yazıcı / Tartı cihaz desteği',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2.5 text-[14.5px] text-white/90">
                    <DotCheckLight />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                Anlık platform durumu
              </p>
              <p className="mt-3 font-italiana text-[64px] leading-none tracking-[-0.02em] sm:text-[88px]">
                26.9K
              </p>
              <p className="mt-1 text-[14px] text-white/75">Son 30 günde tamamlanan sipariş</p>

              <div className="mt-8 grid gap-4">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Bu hafta öne çıkan kategori
                  </p>
                  <p className="mt-1 text-[18px] font-semibold">Pizza · +24% ciro</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Ortalama hazırlama süresi
                  </p>
                  <p className="mt-1 text-[18px] font-semibold">14 dk · −18% trend</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
                Sıkça sorulanlar
              </p>
              <h2 className="mt-3 font-italiana text-[40px] leading-[1.06] tracking-[-0.02em] sm:text-[52px]">
                Önce buna bakalım.
              </h2>
              <p className="mt-4 text-[16px] leading-[1.65] text-ink-600">
                Cevabını bulamadın mı? Tenant ekibimize{' '}
                <a href="mailto:tenant@lieferzonen.com" className="font-semibold text-primary-700 hover:underline">
                  tenant@lieferzonen.com
                </a>{' '}
                üzerinden ulaşabilirsin.
              </p>
            </div>

            <div className="grid gap-3">
              {FAQ_ITEMS.map(([q, a]) => (
                <details
                  key={q}
                  className="group rounded-2xl border border-ink-200 bg-white px-5 py-4 open:border-primary-100 open:bg-primary-50/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-ink-900">
                    {q}
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-[14px] text-ink-700 transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[14.5px] leading-[1.7] text-ink-600">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────── */}
        <section className="bg-ink-50">
          <div className="mx-auto flex max-w-[1280px] flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
              Hazır mısın?
            </p>
            <h2 className="mt-3 max-w-[720px] font-italiana text-[42px] leading-[1.04] tracking-[-0.02em] text-ink-900 sm:text-[60px]">
              Bugün başvur, bu hafta ilk siparişini al.
            </h2>
            <p className="mt-4 max-w-[560px] text-[16px] leading-[1.7] text-ink-600">
              Ücretsiz başvur; setup ücreti, sabit aidat yok. Komisyon ilk siparişinde başlar.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button className="h-12 rounded-full px-8 text-[15px]" onClick={scrollToForm}>
                Başvuru başlat
              </Button>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="inline-flex h-12 items-center justify-center rounded-full border border-ink-200 bg-white px-8 text-[14.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
              >
                Hesabıma giriş yap
              </button>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="border-t border-ink-100 bg-white">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[12.5px] text-ink-500 sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} {platformName} — Tüm hakları saklıdır.</p>
            <div className="flex flex-wrap gap-4">
              <a href="/me/legal" className="hover:text-ink-800">Kullanım Şartları</a>
              <a href="/me/legal" className="hover:text-ink-800">Gizlilik</a>
              <button type="button" onClick={() => router.push('/login')} className="hover:text-ink-800">
                Tenant girişi
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );

}

/* ── Small icons ──────────────────────────────────────────────────────── */

function DotCheck() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-50 text-primary-700">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7" />
      </svg>
    </span>
  );
}

function DotCheckLight() {
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7" />
      </svg>
    </span>
  );
}

function IconBag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14l-1.2 12.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
