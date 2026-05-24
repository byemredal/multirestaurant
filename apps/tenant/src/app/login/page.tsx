'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@lieferzonen/ui';
import { Input } from '@lieferzonen/ui';
import { PlatformLogo } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { apiBaseUrl } from '@/lib/tenant-client';

const TENANT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80';

export default function TenantLoginPage() {
  const router = useRouter();
  const { login } = useTenantAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
      // No navigation here — TenantGate routes on the resolved status.
    } catch {
      setError('Giriş başarısız. E-posta veya şifrenizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1280px] items-stretch overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-card">
        {/* ── Left: form panel ───────────────────────────────────────────── */}
        <div className="flex w-full flex-col bg-white px-6 py-8 sm:px-10 lg:w-1/2 lg:px-14 lg:py-12">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-1.5 text-[13px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
            >
              <PlatformLogo apiBaseUrl={apiBaseUrl} height={18} />
            </a>
            <a
              href="/"
              className="text-[13px] font-medium text-ink-500 transition hover:text-ink-800"
            >
              Ana sayfaya dön
            </a>
          </div>

          <form
            onSubmit={onSubmit}
            className="mx-auto mt-12 flex w-full max-w-[420px] flex-1 flex-col justify-center"
            noValidate
          >
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary-700">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Tenant
              </span>
              <h1 className="mt-5 text-[30px] font-bold tracking-[-0.02em] text-ink-900 sm:text-[34px]">
                Tenant girişi
              </h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500">
                Restoranınızı yönetmek için stüdyoya giriş yapın.
              </p>
            </div>

            <div className="mt-8 grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor="tenant-email" className="px-1 text-[12.5px] font-medium text-ink-600">
                  E-posta
                </label>
                <Input
                  id="tenant-email"
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@restoran.com"
                  className="h-12 rounded-full px-5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between px-1">
                  <label htmlFor="tenant-password" className="text-[12.5px] font-medium text-ink-600">
                    Şifre
                  </label>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-primary-700 hover:text-primary-800"
                  >
                    Şifremi unuttum
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="tenant-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-12 rounded-full px-5 pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
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
              type="submit"
              size="lg"
              className="mt-6 h-12 w-full rounded-full text-[15px]"
              disabled={loading}
            >
              {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </Button>

            <div className="mt-6 flex items-center gap-3 text-[12px] uppercase tracking-[0.16em] text-ink-400">
              <span className="h-px flex-1 bg-ink-200" />
              veya
              <span className="h-px flex-1 bg-ink-200" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink-200 bg-white text-[13.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
              >
                <IconApple />
                Apple
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink-200 bg-white text-[13.5px] font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
              >
                <IconGoogle />
                Google
              </button>
            </div>
          </form>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5 text-[12.5px] text-ink-500">
            <p>
              Hesabınız yok mu?{' '}
              <button
                type="button"
                onClick={() => router.push('/')}
                className="font-semibold text-primary-700 hover:text-primary-800"
              >
                Başvuru yap
              </button>
            </p>
            <div className="flex gap-4">
              <a href="/me/legal" className="hover:text-ink-800">Şartlar</a>
              <a href="/me/legal" className="hover:text-ink-800">Gizlilik</a>
            </div>
          </div>
        </div>

        {/* ── Right: imagery panel ───────────────────────────────────────── */}
        <aside className="relative hidden w-1/2 overflow-hidden bg-primary-50 lg:block">
          <div className="absolute inset-6 overflow-hidden rounded-3xl bg-ink-200">
            <Image
              src={TENANT_HERO_IMAGE}
              alt="Restoran sahibi tablette siparişleri yönetiyor"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-900/70 via-ink-900/30 to-transparent" />

            <div className="absolute inset-x-8 bottom-8 text-white">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Lieferzonen Studio
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em]">
                Restoranınızı tek bir akış üzerinden işletin.
              </h2>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/85">
                Siparişler, menü ve operasyon — gerçek zamanlı senkron.
              </p>
            </div>
          </div>

          <div className="absolute right-10 top-10 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 text-[12px] font-semibold text-ink-800 shadow-pop backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Canlı sipariş akışı
          </div>

          <div className="absolute right-10 top-[28%] z-10 w-[230px] rounded-2xl border border-white/70 bg-white/95 p-4 shadow-pop backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Bugün</p>
            <p className="mt-1 text-[28px] font-bold leading-none tracking-[-0.02em] text-ink-900">
              24 sipariş
            </p>
            <div className="mt-3 flex h-12 items-end gap-1.5">
              {[28, 42, 18, 56, 34, 62, 48].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-3 rounded-full ${i === 5 ? 'bg-primary' : 'bg-primary-100'}`}
                />
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-500">
              Geçen haftaya göre{' '}
              <span className="font-semibold text-primary-700">+18%</span>
            </p>
          </div>

          <div className="absolute left-10 top-[58%] z-10 w-[280px] rounded-2xl border border-white/70 bg-white/95 p-4 shadow-pop backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <IconBag />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">#LZ-2841</p>
                  <p className="text-[11.5px] text-ink-500">Margherita · 2 ürün</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-warning-700">
                Hazırlanıyor
              </span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-ink-100">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
            <p className="mt-2 text-[11.5px] text-ink-500">Kurye 8 dk içinde varacak</p>
          </div>
        </aside>
      </div>
    </div>
  );

}


/* ── Icons ────────────────────────────────────────────────────────────── */

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 3 18 18" />
      <path d="M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.5 4.2M6.7 6.7A17 17 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.9-.7" />
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" />
    </svg>
  );
}

function IconApple() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.86c-.02-2.27 1.85-3.36 1.93-3.41-1.05-1.54-2.69-1.75-3.27-1.78-1.39-.14-2.71.82-3.42.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.88-3.71 2.24-1.59 2.74-.41 6.79 1.13 9.01.76 1.09 1.66 2.31 2.83 2.27 1.14-.05 1.57-.74 2.96-.74 1.38 0 1.77.74 2.97.71 1.23-.02 2-1.11 2.74-2.2.87-1.26 1.22-2.49 1.24-2.55-.03-.01-2.39-.92-2.42-3.59ZM14.04 6.16c.62-.76 1.05-1.81.93-2.86-.9.04-1.99.6-2.64 1.36-.58.66-1.09 1.73-.95 2.76 1.01.08 2.04-.51 2.66-1.26Z" />
    </svg>
  );
}

function IconGoogle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.227c0-.708-.063-1.39-.18-2.045H12v3.868h5.38a4.6 4.6 0 0 1-1.996 3.018v2.51h3.23c1.892-1.74 2.986-4.3 2.986-7.351Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.23-2.51c-.895.6-2.04.955-3.388.955-2.605 0-4.81-1.76-5.6-4.123H3.067v2.59A9.997 9.997 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.4 13.9A6.005 6.005 0 0 1 6.08 12c0-.66.114-1.3.32-1.9V7.51H3.067A9.997 9.997 0 0 0 2 12c0 1.614.386 3.142 1.067 4.49L6.4 13.9Z" fill="#FBBC05" />
      <path d="M12 5.977c1.47 0 2.787.506 3.823 1.498l2.867-2.867C16.96 2.99 14.695 2 12 2 8.087 2 4.703 4.244 3.067 7.51L6.4 10.1C7.19 7.736 9.395 5.977 12 5.977Z" fill="#EA4335" />
    </svg>
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
