'use client';

import { useRouter } from 'next/navigation';
import { SetupButton } from '@/components/SetupButton';

/**
 * Setup welcome / intro. Reaching this page means the wizard gate (the
 * `/setup` layout) already confirmed the platform is not yet initialized,
 * so this page only has to introduce the flow.
 */
export default function SetupWelcomePage() {
  const router = useRouter();

  return (
    <div>
      <span className="inline-flex items-center gap-[7px] rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
        Welcome
      </span>
      <h1 className="mb-1.5 mt-4 text-2xl font-semibold leading-[1.2] tracking-[-0.02em]">
        Let&apos;s initialize your platform
      </h1>
      <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
        Four short steps set the essentials in place: platform identity, your
        launch market, and the first super admin account. You will need the
        platform&apos;s bootstrap key to finish.
      </p>
      <div className="mt-7 flex justify-between gap-3 max-[520px]:flex-col-reverse">
        <span />
        <SetupButton
          variant="primary"
          grow
          onClick={() => router.push('/setup/platform')}
        >
          Begin setup
        </SetupButton>
      </div>
    </div>
  );
}
