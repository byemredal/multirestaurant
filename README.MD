# Lieferzonen — Multi-Store Marketplace / SaaS Platform

Lieferzonen; multi store bir sipariş platformudur. Müşteriler konum bazlı
store keşfedip sipariş verir, store sahipleri (partner) kendi
operasyonlarını yönetir, platform sahibi ise tüm sistemi admin panelinden
yönetir. Hedef; bir **marketplace + store SaaS** hibritidir.

> Bu repo aktif geliştirme aşamasındadır. Backend domain çekirdeği görece
> ileridedir; müşteri storefront'u ürünleşme önceliğidir.

---

## 1. Yüzeyler

Platform dört kullanıcı yüzeyinden oluşur:

| Yüzey | Uygulama | Port | Açıklama |
|---|---|---|---|
| **Customer** | `apps/web` | 3000 | Müşteri storefront — keşif, menü, sepet, checkout |
| **Admin** | `apps/admin` | 3051 | Platform operasyon paneli — başvuru/onay, ayarlar |
| **Tenant** | `apps/tenant` | 3060 | Store sahibi paneli — onboarding, menü, sipariş |
| **Setup** | `apps/setup` | 3070 | Tek seferlik platform kurulum sihirbazı |
| **API** | `apps/api` | 4000 | NestJS backend — tüm domain servisleri |

---

## 2. Monorepo Yapısı

pnpm workspace tabanlı monorepo:

```
apps/
  api      — NestJS backend (PostgreSQL, JWT auth, domain modülleri)
  web      — Next.js müşteri storefront'u
  admin    — Next.js admin paneli
  tenant   — Next.js tenant/store paneli
  setup    — Next.js platform kurulum sihirbazı (sonradan eklendi.)
packages/
  config   — @lieferzonen/config — kod-temelli branding & ülke konfigürasyonu
  ui       — @lieferzonen/ui — paylaşılan React UI component'leri
shared/
  system-state-gate.tsx — app'ler arası paylaşılan kurulum kapısı (path-mapped)
locales/   — uygulamalar arası i18n mesajları (@locales/*)
infra/
  docker/  — docker-compose.yml (postgres, redis, api ve frontend'ler)
scripts/   — yerel geliştirme / DB yardımcı scriptleri
```

### Paylaşılan kod

- **`packages/ui` (`@lieferzonen/ui`)** — Paylaşılan, uygulamadan bağımsız
  React UI component'lerinin tek adresi. Yeni ortak bir component eklenirken
  her app'te ayrı yazılmaz; buraya eklenir. Tüketen app'in `transpilePackages`
  ve Tailwind `content` ayarına eklenmesi gerekir (bkz. `packages/ui/README.md`).
- **`packages/config` (`@lieferzonen/config`)** — Kod-temelli branding ve ülke
  konfigürasyonu. Dinamik runtime engine yoktur; ülke ekleme tek dosyalık bir
  değişikliktir.
- **`shared/`** — App'ler arası paylaşılan, path-mapped (`@shared/*`) kaynak
  dosyalar (örn. kurulum kapısı component'i).

---

## 3. Teknoloji

- **Dil:** TypeScript
- **Frontend:** Next.js 14 (App Router), React 18, TailwindCSS
- **Backend:** NestJS 11, modüler domain mimarisi (modüler monolith)
- **Veritabanı:** PostgreSQL (`apps/api/db/migrations` altında SQL migration'lar)
- **Auth:** JWT (access + refresh), bcrypt; ayrı customer / tenant / admin kimlikleri
- **Paket yöneticisi:** pnpm (workspace)
- **Altyapı:** Docker Compose (PostgreSQL, Redis), env-tabanlı config

---

## 4. Kurulum ve Çalıştırma

### Gereksinimler
- Node.js ≥ 20, pnpm
- Docker (PostgreSQL/Redis için) veya yerel bir PostgreSQL

### Yerel geliştirme

```bash
pnpm install                # tüm workspace bağımlılıkları
pnpm run build:config       # @lieferzonen/config derlenir (API bunu import eder)
pnpm run db:init            # PostgreSQL migration'larını uygular

pnpm run dev:api            # API        → http://localhost:4000
pnpm run dev:web            # Customer   → http://localhost:3000
pnpm run dev:admin          # Admin      → http://localhost:3051
pnpm run dev:tenant         # Tenant     → http://localhost:3060
pnpm run dev:setup          # Setup      → http://localhost:3070
```

### Docker ile

Compose dosyaları `base + overlay` desenindedir:

- `infra/docker/docker-compose.yml` — ortak temel (base)
- `infra/docker/docker-compose.override.yml` — geliştirme katmanı
- `infra/docker/docker-compose.prod.yml` — production katmanı

```bash
# Geliştirme
pnpm run docker:up        # base + override (proje: lieferzonen)
pnpm run docker:down

# Production (önce infra/docker/.env.prod hazırlanır)
pnpm run docker:prod      # base + prod   (proje: lieferzonen-prod)
pnpm run docker:prod:down
```

`installer` bağımlılıkları kurar, `migrator` şemayı uygular, ardından API ve
tüm frontend'ler (setup dahil) ayağa kalkar. Production'da ek olarak `builder`
servisi tüm uygulamaları derler.

---

## 5. Platform Bootstrap / Kurulum Sistemi

Platform ilk kullanımdan önce **bir kez** kurulmalıdır. Bu akış kasıtlı olarak
minimaldir (dinamik onboarding/terminoloji engine'i yoktur).

### Yaşam döngüsü

`SYSTEM_STATE`: `UNINITIALIZED → INITIALIZING → READY`

- `GET /api/v1/system/state` — sistem durumunu raporlar.
- `POST /api/v1/setup/initialize` — tek seferlik bootstrap; `SetupGuard` ile
  korunur (sistem READY değilse + geçerli `X-Bootstrap-Key` şartı).
- Initialize akışı tek transaction'da: super admin oluşturur, branding +
  ülke konfigürasyonunu kaydeder, minimal legal dokümanları seed eder ve
  durumu `READY` yapar. Hata olursa güvenle `UNINITIALIZED`'a döner.

### Kurulum sihirbazı (`apps/setup`)

Lineer 4 adım: Platform bilgisi → Ülke → Super admin → Initialize.
Kurulum tamamlandığında sihirbaz pasifleşir ve admin login'e yönlendirir.

### Kurulum kapısı (gate)

`web`, `admin`, `tenant` uygulamaları açılışta `GET /config/branding`'i
kontrol eder. Platform kurulu değilse uygulama kullanıma kapatılır ve
kullanıcı kurulum sihirbazına yönlendirilir. Kurulum tamamlandıktan sonra
kontrol tamamen pasiftir (sonuç önbelleğe alınır).

### Branding & ülke konfigürasyonu

- `GET /api/v1/config/branding` — platform adı, destek e-postası, logo,
  varsayılan ülke/dil/para birimi/saat dilimi.
- `GET /api/v1/config/country` — birincil ülkenin kod-temelli konfigürasyonu.
- Başlangıç desteği: yalnızca İsviçre (CH). Mimari ileride ülke eklemeye açık.

---

## 6. Domain Sınırları

En kritik kural: domainlerin birbirine karışmaması.

- **TenantAccount** — restoran sahibi / işletme hesabı (giriş, başvuru, belge).
- **Store** — müşteriye görünen restoran/işletme varlığı (marka, mutfak, durum).
- **Menu / MenuCategory / MenuItem / OptionGroup** — menü yapısı ve seçim kümeleri.
- **Cart** — müşterinin aktif sepeti.
- **Order** — sipariş ana kaydı; ürün davranışının merkezi.
- **Payment / Commission** — finansal omurga.
- **LegalDocument / ConsentEvent** — yasal doküman ve onay kayıtları.

Sahiplik zinciri net olmalıdır:
`TenantAccount → Store → Menu → Order → Payment`

---

## 7. Mimari Kurallar

- Tenant (hesap) ile Store (işletme) varlıkları tek tabloya sıkıştırılmaz.
- Order domaini merkezdir — order olmadan marketplace yoktur.
- Payment / commission sonradan yamanmaz; finansal omurga baştan düşünülür.
- Menü domaini (modifier/option/availability) en baştan doğru modellenir.
- Mock ekran, tamamlanmış feature gibi sunulmaz.
- Yeni dosya üretmeden önce mevcut yapı okunur; domain sorumluluğu bozulmaz.
- Paylaşılan UI component'leri `packages/ui` içine yazılır.

---

## 8. Geliştirme Fazları

1. **Stabilizasyon** — repo yapısı, isimlendirme, env, build/dev akışları.
2. **Marketplace çekirdeği** — restoran keşfi → menü → sepet → checkout → order.
3. **Partner operasyonları** — onboarding, admin onayı, menü/sipariş yönetimi.
4. **Admin & finansal omurga** — başvuru yönetimi, komisyon, payout, raporlar.
5. **Operasyonel büyüme** — teslimat bölgeleri, kurye, bildirim, iade, review.

---

## 9. İlk Gerçek MVP

MVP, şu zinciri eksiksiz sağlayan sürümdür:

**Restoran keşfi → menü seçimi → sepet → checkout → sipariş oluşturma →
restoran tarafında sipariş yönetimi → admin gözetimi**

Bu zincir çalışmadan sistem gerçek bir marketplace MVP kabul edilmez.

---

## 10. API / Swagger

Backend için artımlı bir OpenAPI dokümantasyonu mevcuttur:

- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs-json`
- OpenAPI YAML: `http://localhost:4000/api/docs-yaml`

Tüm API endpoint'leri `api/v1` global prefix'i altındadır
(örn. `http://localhost:4000/api/v1/health`).

Swagger kapsamı bilinçli olarak artımlıdır: auth, store, menu, cart ve order
yüzeyleri önceliklendirilmiştir; bazı response şemaları henüz tam değildir.

---

## 11. Kod Üretim Kuralları

- Var olmayan bir feature tamamlanmış gibi gösterilmez; mock ise belirtilir.
- Değişiklikler küçük ve odaklı ürün dilimleri halinde yapılır.
- Endpoint tasarlamadan/kullanmadan önce gerçek controller ve servis dosyaları
  incelenir.
- Her anlamlı değişiklikten sonra rapor verilir: ne değişti, neden, hangi risk
  kapandı, hangi dosyalar etkilendi, sıradaki adım.
