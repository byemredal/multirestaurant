'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PlatformLogo, usePlatformBranding } from '@lieferzonen/ui';
import { apiBaseUrl } from '@/lib/config';
import type { RegionSearchResult } from '@/lib/home-discovery';

/* ── Free-license imagery (Unsplash) ──────────────────────────────────── */
const IMG_HERO_FOOD =
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80';
const IMG_ABOUT =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80';
const IMG_HOW_BG =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80';
const IMG_TESTIMONIAL_1 =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80';
const IMG_TESTIMONIAL_2 =
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80';
const IMG_TESTIMONIAL_3 =
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80';
const IMG_AVATAR_1 =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80';
const IMG_AVATAR_2 =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80';
const IMG_AVATAR_3 =
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=80';

/* ── Static content (Lieferzonen voice, not copied) ───────────────────── */

const CATEGORIES: Array<{ name: string; img: string; tagline: string }> = [
  {
    name: 'Pizza',
    tagline: 'Fırından sıcak',
    img: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Burger',
    tagline: '15 dk teslimat',
    img: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Sushi',
    tagline: 'Taze hazırlanır',
    img: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Salata',
    tagline: 'Mevsim ürünleri',
    img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Tatlı',
    tagline: 'Günlük taze',
    img: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Kahve',
    tagline: 'Yerel kavurma',
    img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
  },
];

const TESTIMONIALS: Array<{
  name: string;
  city: string;
  rating: number;
  text: string;
  img: string;
}> = [
  {
    name: 'Selin K.',
    city: 'Kadıköy',
    rating: 5,
    text: 'Sipariş ettiğim restoran 12 dakikada teslim etti. Uygulama ferah, kategori filtreleri tam istediğim gibi.',
    img: IMG_TESTIMONIAL_1,
  },
  {
    name: 'Burak A.',
    city: 'Beşiktaş',
    rating: 5,
    text: 'Yerel mekânları tek yerde toplaması harika. Kuryelerin canlı takibi de çok rahat.',
    img: IMG_TESTIMONIAL_2,
  },
  {
    name: 'Aylin M.',
    city: 'Bornova',
    rating: 4,
    text: 'Menü fotoğrafları gerçeğe çok yakın. Sipariş ekranı kafa karıştırmıyor, hızlıca işlemi bitiriyorum.',
    img: IMG_TESTIMONIAL_3,
  },
];

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  searchLoading: boolean;
  searchResults: RegionSearchResult[];
  onSelectRegion: (region: RegionSearchResult) => void;
};

export default function HomeLanding({
  query,
  onQueryChange,
  searchLoading,
  searchResults,
  onSelectRegion,
}: Props) {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const branding = usePlatformBranding(apiBaseUrl);
  const platformName = branding?.platformName?.trim() || 'Platform';

  useEffect(() => {
    if (!query.trim()) {
      setActiveIndex(-1);
    }
  }, [query]);

  const trimmed = query.trim();
  const showDropdown = open && trimmed.length > 0;
  const limited = searchResults.slice(0, 6);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || limited.length === 0) {
      if (e.key === 'Enter' && searchResults[0]) {
        e.preventDefault();
        onSelectRegion(searchResults[0]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((idx) => (idx + 1) % limited.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((idx) => (idx <= 0 ? limited.length - 1 : idx - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = limited[activeIndex >= 0 ? activeIndex : 0];
      if (target) onSelectRegion(target);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="bg-white text-ink-900">
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/60 via-white to-white" />

        <div className="relative mx-auto grid max-w-[1280px] gap-12 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-16">
          {/* Left: copy + search */}
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-100 bg-white px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-700 shadow-card">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Yakınında 250+ restoran açık
            </span>

            <h1 className="mt-6 text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-ink-900 sm:text-[60px]">
              En yakın <span className="text-primary-700">lezzet</span>,
              <br className="hidden sm:block" />
              <span className="font-italiana font-normal italic text-ink-900">kapına</span> dakikalar içinde.
            </h1>

            <p className="mt-5 max-w-[520px] text-[17px] leading-[1.65] text-ink-600">
              Adresini gir, mahallendeki restoranları keşfet. Menüye göz at, sıcağı sıcağına sipariş ver.
            </p>

            {/* ── Search box (UX-improved) ───────────────────────────── */}
            <div className="relative mt-9 max-w-[560px]">
              <label htmlFor={inputId} className="sr-only">
                Adres veya posta kodu
              </label>

              <div
                className={`flex items-center overflow-hidden rounded-full bg-white pr-1.5 transition shadow-card ring-1 ${
                  open ? 'ring-2 ring-primary/30' : 'ring-ink-200'
                }`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center text-ink-500">
                  <PinIcon />
                </span>

                <input
                  ref={inputRef}
                  id={inputId}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showDropdown}
                  aria-controls={listboxId}
                  aria-activedescendant={
                    activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
                  }
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Adres, ilçe veya posta kodu"
                  value={query}
                  onChange={(e) => {
                    onQueryChange(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => window.setTimeout(() => setOpen(false), 120)}
                  onKeyDown={onKeyDown}
                  className="h-12 flex-1 bg-transparent pr-3 text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
                />

                {/* loading / clear cluster */}
                <div className="flex items-center gap-1 pr-1">
                  {searchLoading ? (
                    <span aria-hidden className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-primary" />
                  ) : null}

                  {query ? (
                    <button
                      type="button"
                      aria-label="Aramayı temizle"
                      onClick={() => {
                        onQueryChange('');
                        inputRef.current?.focus();
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                    >
                      <XIcon />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => searchResults[0] && onSelectRegion(searchResults[0])}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-[14px] font-semibold text-white transition hover:bg-primary-600 disabled:opacity-50"
                    disabled={!searchResults[0]}
                  >
                    <SearchIcon />
                    Ara
                  </button>
                </div>
              </div>

              {/* listbox */}
              {showDropdown ? (
                <div
                  id={listboxId}
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-pop"
                >
                  {searchLoading && limited.length === 0 ? (
                    <div className="px-5 py-4 text-[14px] text-ink-500">Aranıyor…</div>
                  ) : limited.length === 0 ? (
                    <div className="px-5 py-4 text-[14px] text-ink-500">
                      Eşleşen bölge yok. Posta kodunu da deneyebilirsin.
                    </div>
                  ) : (
                    <ul className="max-h-[320px] overflow-y-auto py-1.5">
                      {limited.map((region, idx) => {
                        const active = idx === activeIndex;
                        return (
                          <li key={region.id} role="presentation">
                            <button
                              id={`${listboxId}-${idx}`}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => onSelectRegion(region)}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                                active ? 'bg-primary-50' : 'hover:bg-ink-50'
                              }`}
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                                <PinIcon />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-semibold text-ink-900">
                                  {region.postalCode} {region.name}
                                </span>
                                <span className="block truncate text-[12.5px] text-ink-500">
                                  {region.district}
                                </span>
                              </span>
                              <span className="text-[12px] font-semibold text-primary-700">
                                Seç →
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            {/* Trust meta */}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <div className="flex items-center -space-x-2">
                <Image
                  src={IMG_AVATAR_1}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full border-2 border-white object-cover"
                />
                <Image
                  src={IMG_AVATAR_2}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full border-2 border-white object-cover"
                />
                <Image
                  src={IMG_AVATAR_3}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full border-2 border-white object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-1 text-warning-500">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <StarIcon key={i} />
                  ))}
                  <span className="ml-1.5 text-[13.5px] font-semibold text-ink-800">4.9</span>
                </div>
                <p className="text-[12.5px] text-ink-500">250.000+ mutlu müşteri</p>
              </div>
            </div>
          </div>

          {/* Right: visual collage */}
          <div className="relative">
            {/* Big primary disk behind */}
            <div
              aria-hidden
              className="absolute right-2 top-4 h-[78%] w-[88%] rounded-full bg-gradient-to-br from-primary-100 via-primary-50 to-white"
            />
            {/* Dots */}
            <DecoDots />

            {/* Hero photo */}
            <div className="relative mx-auto aspect-square w-full max-w-[480px]">
              <div className="absolute inset-6 overflow-hidden rounded-full bg-ink-100 shadow-pop">
                <Image
                  src={IMG_HERO_FOOD}
                  alt="Taze hazırlanmış yemek tabağı"
                  fill
                  priority
                  sizes="(min-width: 1024px) 460px, 90vw"
                  className="object-cover"
                />
              </div>

              {/* Floating card — Fast delivery */}
              <div className="absolute -left-2 top-12 z-10 w-[200px] rounded-2xl border border-white/70 bg-white p-3.5 shadow-pop">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <BoltIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink-900">Hızlı teslimat</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
                      Ortalama 22 dakika — şubene en yakın kurye.
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating card — Nearest place */}
              <div className="absolute right-0 top-32 z-10 w-[200px] rounded-2xl border border-white/70 bg-white p-3.5 shadow-pop">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
                    <PinIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink-900">Yakındaki mekanlar</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
                      Mahallendeki açık restoranlar listede.
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating card — Dine quality */}
              <div className="absolute -right-2 bottom-10 z-10 w-[210px] rounded-2xl border border-white/70 bg-white p-3.5 shadow-pop">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary-50 text-secondary-600">
                    <PlateIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink-900">Sıcak & taze</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
                      Termal çantalı paketleme — kapına sıcacık.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom stat pill */}
              <div className="absolute -bottom-2 left-1/2 z-10 w-[260px] -translate-x-1/2 rounded-full border border-white/70 bg-white px-4 py-2.5 shadow-pop">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <Image
                      src={IMG_AVATAR_1}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full border-2 border-white object-cover"
                    />
                    <Image
                      src={IMG_AVATAR_2}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full border-2 border-white object-cover"
                    />
                    <Image
                      src={IMG_AVATAR_3}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full border-2 border-white object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-ink-900">Müşteri memnuniyeti</p>
                    <p className="text-[11px] text-ink-500">
                      4.9 / 5 · 250K+ değerlendirme
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat band ────────────────────────────────────────────────── */}
      <section className="border-y border-ink-100 bg-ink-50">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
          {[
            ['12K+', 'Aktif restoran'],
            ['22 dk', 'Ortalama teslimat'],
            ['4.9', 'Ortalama puan'],
            ['81', 'Şehirde aktif'],
          ].map(([value, label]) => (
            <div key={label} className="bg-ink-50 px-5 py-7 text-center sm:py-9">
              <p className="font-italiana text-[40px] leading-none text-ink-900 sm:text-[48px]">
                {value}
              </p>
              <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── About / Quality ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <div className="relative aspect-[5/6] w-full overflow-hidden rounded-3xl bg-ink-100 shadow-card">
              <Image
                src={IMG_ABOUT}
                alt="Kahvaltı sofrası — çeşitli tabaklar"
                fill
                sizes="(min-width: 1024px) 540px, 100vw"
                className="object-cover"
              />
            </div>
            {/* Frame outline */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-6 h-[90%] w-[90%] rounded-3xl border-2 border-primary-100"
            />
            {/* Small badge */}
            <div className="absolute -left-3 bottom-10 hidden rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-pop sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                Yerel partner
              </p>
              <p className="mt-1 text-[20px] font-bold text-ink-900">+820 mahalle esnafı</p>
            </div>
          </div>

          <div>
            <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
              <span className="h-px w-8 bg-primary-700" />
              Hakkımızda
            </p>
            <h2 className="mt-3 font-italiana text-[40px] leading-[1.04] tracking-[-0.02em] text-ink-900 sm:text-[52px]">
              Lezzeti güvenle taşıyoruz.
            </h2>
            <p className="mt-5 max-w-[520px] text-[16.5px] leading-[1.7] text-ink-600">
              Termal çantalı kuryeler, eğitimli ekipler ve yerelinde test edilmiş restoran ağı.
              Senin önceliğin yemek; lojistik ve operasyonu biz çözeriz.
            </p>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                ['Hijyen kontrolü', 'Periyodik denetim ile partner mutfaklar'],
                ['Canlı takip', 'Kurye konumu siparişle birlikte ekranda'],
                ['Şeffaf fiyat', 'Servis bedeli sipariş öncesi netleşir'],
                ['Esnek ödeme', 'Kart, kapıda nakit ya da yemek kuponu'],
              ].map(([title, desc]) => (
                <li
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <CheckIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink-900">{title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-ink-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[14.5px] font-semibold text-white transition hover:bg-primary-600"
                onClick={() => inputRef.current?.focus()}
              >
                Adresimle başla
                <span aria-hidden>→</span>
              </button>
              <Link
                href="/tenant/signup"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-ink-200 bg-white px-6 text-[14.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
              >
                Restoranını ekle
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ──────────────────────────────────────────────── */}
      <section className="bg-ink-50">
        <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-[560px]">
              <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
                <span className="h-px w-8 bg-primary-700" />
                Bugün ne yesem
              </p>
              <h2 className="mt-3 font-italiana text-[40px] leading-[1.04] tracking-[-0.02em] sm:text-[52px]">
                Bir tıkla mutfağa.
              </h2>
            </div>
            <p className="max-w-[420px] text-[14.5px] leading-relaxed text-ink-600">
              Mahallendeki en yoğun kategoriler. Her birinde kontrol edilmiş partner restoranlar.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-ink-100 bg-white text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
              >
                <Image
                  src={cat.img}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 200px, 45vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.05]"
                />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-900/75 via-ink-900/20 to-transparent" />
                <span className="absolute inset-x-3 bottom-3 text-white">
                  <span className="block text-[15px] font-semibold tracking-tight">{cat.name}</span>
                  <span className="mt-0.5 block text-[11.5px] text-white/85">{cat.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0">
          <Image src={IMG_HOW_BG} alt="" fill sizes="100vw" className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-ink-900/70" />
        </div>
        <div className="relative mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-[640px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Nasıl çalışır
            </p>
            <h2 className="mt-3 font-italiana text-[40px] leading-[1.06] tracking-[-0.02em] sm:text-[54px]">
              Üç adım, kısa bir bekleyiş.
            </h2>
            <p className="mt-4 max-w-[520px] text-[15.5px] leading-[1.7] text-white/80">
              Karmaşık form yok, kayıt zorunlu değil. Adresini gir — gerisini biz hallederiz.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Adresini gir',
                desc: 'Mahalleni ya da posta kodunu yaz; sana en yakın restoranları getirelim.',
                icon: <PinIcon />,
              },
              {
                step: '02',
                title: 'Menüyü keşfet',
                desc: 'Kategorileri tara, fiyatları gör, favorini sepete ekle.',
                icon: <PlateIcon />,
              },
              {
                step: '03',
                title: 'Kurye yolda',
                desc: 'Siparişini canlı takip et; kuryeyle direkt iletişimde ol.',
                icon: <BoltIcon />,
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <span className="font-italiana text-[40px] leading-none text-white/90">
                    {s.step}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white">
                    {s.icon}
                  </span>
                </div>
                <h3 className="mt-5 text-[20px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.65] text-white/80">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-end gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
              <span className="h-px w-8 bg-primary-700" />
              Müşterimiz ne diyor
            </p>
            <h2 className="mt-3 font-italiana text-[40px] leading-[1.04] tracking-[-0.02em] sm:text-[52px]">
              Bizi yorumlardan tanı.
            </h2>
          </div>
          <p className="text-[14.5px] text-ink-500">
            Son 30 günde <span className="font-semibold text-ink-800">12.480 yeni yorum</span> bırakıldı.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="flex flex-col rounded-3xl border border-ink-100 bg-white p-6 shadow-card"
            >
              <div className="flex items-center gap-1 text-warning-500">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>
              <p className="mt-4 flex-1 text-[14.5px] leading-[1.7] text-ink-700">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-4">
                <Image
                  src={t.img}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-[13.5px] font-semibold text-ink-900">{t.name}</p>
                  <p className="text-[12px] text-ink-500">{t.city}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── App / Partner CTA ────────────────────────────────────────── */}
      <section className="bg-ink-50">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8">
          {/* Customer app card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-400 p-8 text-white shadow-card">
            <div aria-hidden className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/85">
              Yeni — mobil uygulama
            </p>
            <h3 className="mt-3 font-italiana text-[36px] leading-[1.05] tracking-[-0.02em] sm:text-[44px]">
              Cebinde sıcak teslimat.
            </h3>
            <p className="mt-3 max-w-[420px] text-[14.5px] leading-[1.7] text-white/85">
              Sipariş geçmişin, favori restoranların ve canlı kurye takibi tek yerde.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13.5px] font-semibold text-ink-900 transition hover:bg-ink-100"
              >
                <AppleIcon />
                App Store
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13.5px] font-semibold text-ink-900 transition hover:bg-ink-100"
              >
                <PlayIcon />
                Google Play
              </button>
            </div>
          </div>

          {/* Partner CTA */}
          <div className="relative overflow-hidden rounded-3xl border border-ink-100 bg-white p-8 shadow-card">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-700">
              Restoran sahibi misin?
            </p>
            <h3 className="mt-3 font-italiana text-[36px] leading-[1.05] tracking-[-0.02em] text-ink-900 sm:text-[44px]">
              {platformName} partneri ol.
            </h3>
            <p className="mt-3 max-w-[420px] text-[14.5px] leading-[1.7] text-ink-600">
              Şeffaf komisyon, yerel destek ve hızlı onboarding. Bu hafta canlıya çık.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/tenant/signup"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-900 px-5 text-[13.5px] font-semibold text-white transition hover:bg-ink-800"
              >
                Başvuru başlat
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/tenant/login"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-ink-200 bg-white px-5 text-[13.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
              >
                Partner girişi
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-ink-900 text-white">
        <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-2">
                <PlatformLogo apiBaseUrl={apiBaseUrl} height={32} />
              </Link>
              <p className="mt-4 max-w-[360px] text-[13.5px] leading-[1.7] text-white/70">
                Mahallenin sıcak yemeği, dakikalar içinde kapına. Yerel restoranlar, eğitimli
                kuryeler, şeffaf hizmet.
              </p>
              <div className="mt-5 flex gap-2">
                {['IG', 'X', 'FB', 'YT'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={s}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {[
              {
                title: 'Keşfet',
                links: [
                  ['Restoranlar', '/'],
                  ['Şehirler', '/'],
                  ['Kampanyalar', '/'],
                  ['Hediye çekleri', '/'],
                ],
              },
              {
                title: 'İş Ortağı',
                links: [
                  ['Restoran ekle', '/tenant/signup'],
                  ['Kurye başvurusu', '/'],
                  ['Kurumsal', '/'],
                  ['Partner girişi', '/tenant/login'],
                ],
              },
              {
                title: 'Yardım & Hukuk',
                links: [
                  ['Yardım Merkezi', '/'],
                  ['İletişim', '/'],
                  ['Kullanım Şartları', '/me/legal'],
                  ['Gizlilik', '/me/legal'],
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  {col.title}
                </p>
                <ul className="mt-4 grid gap-2.5 text-[13.5px] text-white/80">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="transition hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-[12.5px] text-white/55">
            <p>© {new Date().getFullYear()} {platformName} — Tüm hakları saklıdır.</p>
            <p>Made with 🌱 in Türkiye</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Icons & decorations ──────────────────────────────────────────────── */

function Icon({ children, className = 'h-5 w-5' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function PinIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </Icon>
  );
}

function SearchIcon() {
  return (
    <Icon className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  );
}

function XIcon() {
  return (
    <Icon className="h-3.5 w-3.5">
      <path d="M18 6L6 18M6 6l12 12" />
    </Icon>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5l2.95 6.59 7.19.62-5.45 4.78 1.63 7.01L12 17.78l-6.32 3.72 1.63-7.01L1.86 9.71l7.19-.62L12 2.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <Icon className="h-3.5 w-3.5">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

function BoltIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </Icon>
  );
}

function PlateIcon() {
  return (
    <Icon className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.86c-.02-2.27 1.85-3.36 1.93-3.41-1.05-1.54-2.69-1.75-3.27-1.78-1.39-.14-2.71.82-3.42.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.88-3.71 2.24-1.59 2.74-.41 6.79 1.13 9.01.76 1.09 1.66 2.31 2.83 2.27 1.14-.05 1.57-.74 2.96-.74 1.38 0 1.77.74 2.97.71 1.23-.02 2-1.11 2.74-2.2.87-1.26 1.22-2.49 1.24-2.55-.03-.01-2.39-.92-2.42-3.59ZM14.04 6.16c.62-.76 1.05-1.81.93-2.86-.9.04-1.99.6-2.64 1.36-.58.66-1.09 1.73-.95 2.76 1.01.08 2.04-.51 2.66-1.26Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 3.5v17l14-8.5L4 3.5Z" />
    </svg>
  );
}

function DecoDots() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {[
        { t: '12%', l: '78%', s: 8 },
        { t: '28%', l: '8%', s: 6 },
        { t: '54%', l: '90%', s: 10 },
        { t: '78%', l: '14%', s: 8 },
        { t: '90%', l: '74%', s: 6 },
      ].map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-primary-200"
          style={{ top: d.t, left: d.l, width: d.s, height: d.s }}
        />
      ))}
    </div>
  );
}
