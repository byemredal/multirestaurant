'use client';

import { useParams, usePathname } from 'next/navigation';
import TenantOnboardingWorkspace from '@/components/tenant/onboarding/TenantOnboardingWorkspace';

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export default function TenantOnboardingStateTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ stateToken: string }>();
  const pathname = usePathname();
  const stateToken = Array.isArray(params.stateToken) ? params.stateToken[0] : params.stateToken;

  if (!stateToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-destructive">
        Gecersiz veya eksik state token. Lutfen baglantinizi kontrol edin.
      </div>
    );
  }

  const segments = pathname.split('/').filter(Boolean);
  const tokenSegmentIndex = segments.findIndex(
    (segment) => decodePathSegment(segment) === stateToken,
  );
  const stepSlug = tokenSegmentIndex >= 0 ? segments[tokenSegmentIndex + 1] ?? 'welcome' : 'welcome';

  if (stepSlug === 'waiting') {
    return <>{children}</>;
  }

  return <TenantOnboardingWorkspace requestedStep={stepSlug} stateToken={stateToken} />;
}
