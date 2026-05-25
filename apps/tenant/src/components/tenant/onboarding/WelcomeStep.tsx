'use client';

import { useState } from 'react';
import { Card } from '@lieferzonen/ui';
import {
  completeTenantOnboardingWelcome,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type WelcomeStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

export function WelcomeStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: WelcomeStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runOnce = useOnboardingActionGuard();

  async function continueToLocation() {
    await runOnce(async () => {
      let navigating = false;
      setLoading(true);
      setError(null);
      try {
        const result = await completeTenantOnboardingWelcome(workspace.stateToken);
        if (result.workspace) {
          onWorkspaceResolved(result.workspace);
        }
        const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'location';
        navigating = true;
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (continueError) {
        setError(continueError instanceof Error ? continueError.message : 'Devam edilemedi.');
      } finally {
        if (!navigating) {
          setLoading(false);
        }
      }
    });
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={0}
        totalSteps={0}
        status="in_progress"
        updatedAt={workspace.application.updatedAt}
        title="Başvurunuza hoş geldiniz"
        description="Telefon doğrulamanız tamamlandı. Şimdi işletme bilgilerinizi ekleyip başvurunuzu tamamlayacağız."
      />

      <div className="grid gap-4">
        <div className="rounded-[8px] border border-[#d7eadf] bg-[#f0fdf4] px-4 py-4 text-[14px] leading-6 text-[#067647]">
          Teşekkürler. Bundan sonraki adımlarda önce işletmenizin konumunu netleştirecek, sonra doğrulama için gerekli bilgileri tamamlayacağız.
        </div>

        {error ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-4">
            <p className="text-[15px] font-bold text-[#1c1917]">İşletmenizi ekleyin</p>
            <p className="mt-2 text-[13px] leading-6 text-[#586575]">
              Konum, adres ve temel ticari bilgileri adım adım tamamlayın.
            </p>
          </div>
          <div className="rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-4">
            <p className="text-[15px] font-bold text-[#1c1917]">İşletmenizi doğrulayın</p>
            <p className="mt-2 text-[13px] leading-6 text-[#586575]">
              Yetkili kişi, belgeler ve son kontrol ile başvurunuzu incelemeye gönderin.
            </p>
          </div>
        </div>
      </div>

      <OnboardingBottomActionBar
        primaryLabel={resolvedSession?.redirectStep ? 'Yönlendiriliyor' : 'Devam et'}
        onPrimary={() => void continueToLocation()}
        primaryDisabled={Boolean(resolvedSession?.redirectStep)}
        primaryLoading={loading}
      />
    </Card>
  );
}
