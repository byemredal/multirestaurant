'use client';

import { useParams, usePathname } from 'next/navigation';
import TenantOnboardingWorkspace from '@/components/tenant/onboarding/TenantOnboardingWorkspace';
import { tenantOnboardingWorkflowStepBySlug } from '@/components/tenant/onboarding/onboarding-routing';

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

  const initialStep = tenantOnboardingWorkflowStepBySlug[stepSlug];

  if (!initialStep) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-destructive">
        Gecersiz onboarding baglantisi. Lutfen baglantinizi kontrol edin.
      </div>
    );
  }

  return <TenantOnboardingWorkspace initialStep={initialStep} stateToken={stateToken} />;
}
