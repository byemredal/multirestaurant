'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptStaffInviteSession } from '@/lib/auth/staff-client';
import { useStaffAuth } from '@/lib/auth/staff-auth-context';

/**
 * Public accept-invite workspace.
 *
 * Flow:
 *   1) Read `?token=...` from the URL. If missing, surface a manual input
 *      so a staff member who got the token via a different channel can
 *      paste it.
 *   2) Validate password + confirm-password locally (length matches the
 *      backend DTO @Length(8,100)).
 *   3) Post to /staff/accept-invite. The backend responds with a normal
 *      staff session.
 *   4) Success: show a safe placeholder — staff has no dedicated workspace
 *      yet, so DO NOT pretend they can manage menu/settings. The user
 *      explicitly opted out of opening those routes in this slice.
 */
export default function AcceptInviteWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useStaffAuth();
  const tokenFromUrl = searchParams.get('token') ?? '';
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; storeScope: number } | null>(
    null,
  );

  useEffect(() => {
    setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Davet kodu eksik. Tenant yöneticinizden yeni bir bağlantı isteyin.');
      return;
    }
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await acceptStaffInviteSession(token.trim(), password);
      // Persist into staff session storage so /staff/dashboard renders
      // immediately without a re-login round-trip.
      setSession(result);
      setSuccess({
        email: result.staff.email,
        storeScope: result.staff.storeScope.length,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Davet kabul edilemedi. Bağlantınızın hâlâ geçerli olduğundan emin olun.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-10 sm:px-6">
        <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-6 text-center">
          <h1 className="text-[20px] font-semibold text-emerald-900">
            Hoş geldiniz!
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-emerald-800">
            <span className="font-semibold">{success.email}</span> hesabınız aktif edildi.
            {success.storeScope > 0 ? (
              <>
                {' '}
                {success.storeScope} mağaza için yetkilisiniz.
              </>
            ) : null}
          </p>
          <div className="mt-5 rounded-[12px] border border-emerald-200 bg-white p-4 text-left text-[12.5px] leading-5 text-slate-600">
            Hesabınız hazır. Çalışma alanınıza geçebilirsiniz — operasyonel araçlar
            kademeli olarak buraya eklenecek.
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => router.replace('/staff/dashboard')}
              className="rounded-[10px] bg-[#09479A] px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#06366f]"
            >
              Çalışma alanıma git
            </button>
            <Link
              href="/"
              className="rounded-[10px] border border-emerald-300 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              Ana sayfaya dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-10 sm:px-6">
      <div className="rounded-[18px] border border-slate-100 bg-white p-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900">
          Davetinizi kabul edin
        </h1>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
          Şifrenizi belirleyin ve personel hesabınızı aktif edin.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">
              Davet kodu
            </span>
            <input
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={submitting}
              autoComplete="off"
              className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 font-mono text-[12.5px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
            />
            <span className="mt-1 block text-[11.5px] text-slate-500">
              Bağlantınız <code className="font-mono">?token=...</code> içeriyorsa otomatik dolduruldu.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">
              Yeni şifre
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              autoComplete="new-password"
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">
              Şifreyi doğrula
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={submitting}
              autoComplete="new-password"
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
            />
          </label>

          {error ? (
            <div className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-[10px] bg-[#09479A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#06366f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Aktifleştiriliyor…' : 'Şifreyi belirle ve aktifleştir'}
          </button>
        </form>
      </div>
    </div>
  );
}
