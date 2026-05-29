'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStaffAuth } from '@/lib/auth/staff-auth-context';

/**
 * Staff login form. Keep boring — same field layout as the tenant login
 * page (mobile single column, sm+ two columns), but with explicit staff
 * branding so a tenant owner does not mistakenly sign in here.
 */
export function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/staff/dashboard';
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const { login, loading, error } = useStaffAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace(next.startsWith('/staff') ? next : '/staff/dashboard');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Giriş başarısız.');
    } finally {
      setSubmitting(false);
    }
  }

  const renderedError = localError ?? error;
  const busy = submitting || loading;

  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-10 sm:px-6">
      <div className="rounded-[18px] border border-slate-100 bg-white p-6">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#09479A]/[0.08] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#09479A]">
          Personel girişi
        </div>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900">
          Hesabınıza giriş yapın
        </h1>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
          Yöneticinizin verdiği e-posta + şifre ile giriş yapın.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">
              E-posta
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">
              Şifre
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
            />
          </label>

          {sessionExpired && !renderedError ? (
            <div className="rounded-[10px] bg-blue-50 px-3 py-2 text-[12.5px] text-blue-700">
              Oturumunuz sona erdi. Lütfen tekrar giriş yapın.
            </div>
          ) : null}

          {renderedError ? (
            <div className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              {renderedError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[10px] bg-[#09479A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#06366f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>

        <p className="mt-5 text-[11.5px] leading-5 text-slate-500">
          Yeni davet kodunuz mu var?{' '}
          <Link
            href="/staff/accept-invite"
            className="font-semibold text-[#09479A] hover:underline"
          >
            Daveti buradan kabul edin
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
