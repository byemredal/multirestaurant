'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import AuthSurface from '@/components/auth/AuthSurface';
import {
  beginSocialAuth,
  loginCustomer,
  registerCustomer,
  type AuthMode,
} from '@/lib/auth-client';
import { reportTelemetry } from '@/lib/telemetry';
import { writeAuthSession } from '@/lib/storage/auth-session';

type Props = {
  initialMode: AuthMode;
};

export default function AuthPage({ initialMode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const sessionExpiredNotice =
    searchParams.get('reason') === 'session_expired';

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbfe_0%,#f8f5ef_100%)] px-4 py-10">
      {sessionExpiredNotice ? (
        <div className="mx-auto mb-6 max-w-[560px]">
          <div
            role="status"
            className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-center text-[13.5px] leading-relaxed text-ink-700"
          >
            Oturumunuz sona erdi. Lütfen tekrar giriş yapın.
          </div>
        </div>
      ) : null}
      <div className="mx-auto mb-8 max-w-[560px] text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#084799]">Customer account</div>
        <h1 className="mt-4 text-[42px] font-bold leading-[1.05] text-[#16202a]">
          {initialMode === 'login' ? 'Welcome back' : 'Create your storefront account'}
        </h1>
        <p className="mt-3 text-[16px] leading-7 text-[#5d6670]">
          Use email or a connected provider. The same auth surface powers both the page and modal entry points.
        </p>
      </div>
      <AuthSurface
        initialMode={initialMode}
        onSocialAuth={async (provider, mode) => {
          await beginSocialAuth(provider, mode, returnTo);
        }}
        onSubmit={async ({ mode, firstName, lastName, email, password }) => {
          const session = mode === 'login'
            ? await loginCustomer(email, password)
            : await registerCustomer(firstName, lastName, email, password);

          writeAuthSession(session);
          void reportTelemetry({
            type: mode === 'login' ? 'auth_login_success' : 'auth_register_success',
            payload: { accountId: session.account.id, source: 'auth_page' },
          });
        }}
        onSuccess={() => router.push(returnTo)}
        variant="page"
      />
    </main>
  );
}
