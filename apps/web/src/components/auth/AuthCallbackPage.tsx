'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  completeSocialAuth,
  type SocialProvider,
} from '@/lib/auth-client';
import { writeAuthSession } from '@/lib/storage/auth-session';
import { reportTelemetry } from '@/lib/telemetry';

type Props = {
  provider: SocialProvider;
};

export default function AuthCallbackPage({ provider }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const result = await completeSocialAuth(provider, {
          code: searchParams.get('code'),
          state: searchParams.get('state'),
          error: searchParams.get('error'),
        });

        writeAuthSession(result.session);
        void reportTelemetry({
          type: 'auth_social_success',
          payload: {
            provider,
            accountId: result.session.account.id,
          },
        });
        router.replace(result.returnTo || '/');
      } catch {
        setError(
          `${provider[0]?.toUpperCase()}${provider.slice(1)} sign-in could not be completed right now.`,
        );
      }
    };

    void run();
  }, [provider, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fbfe_0%,#f8f5ef_100%)] px-4">
      <div className="w-full max-w-[520px] rounded-[32px] border border-[#e4eaf1] bg-white p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#084799]">
          Social auth
        </div>
        <h1 className="mt-4 text-[34px] font-bold text-[#16202a]">
          {error ? 'Authentication failed' : 'Completing your sign in'}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[#5d6670]">
          {error ??
            `We are finishing your ${provider} authentication and preparing your account session.`}
        </p>
        {error ? (
          <button
            className="mt-6 rounded-full bg-[#084799] px-5 py-3 text-[15px] font-semibold text-white"
            onClick={() => router.replace('/login')}
            type="button"
          >
            Go to login
          </button>
        ) : (
          <div className="mt-6 text-[14px] font-medium text-[#084799]">
            Please wait...
          </div>
        )}
      </div>
    </main>
  );
}
