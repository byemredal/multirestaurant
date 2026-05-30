'use client';

import { useMemo, useState } from 'react';
import { Card, Input } from '@lieferzonen/ui';
import {
  PhoneCodeDeliveryError,
  sendTenantOnboardingPhoneCode,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
  type TenantPhoneVerificationChallenge,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type PhoneVerificationStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

function getSeedPhone(workspace: TenantOnboardingWorkspace) {
  const ownerData = workspace.steps.find((step) => step.stepKey === 'owner_contact_info')
    ?.data as { phoneNumber?: string | null } | undefined;
  return workspace.phoneVerification?.phoneNumber ?? ownerData?.phoneNumber ?? '';
}

function formatSendError(error: unknown) {
  if (error instanceof PhoneCodeDeliveryError) {
    return 'Doğrulama kodu şu anda gönderilemiyor. Lütfen daha sonra tekrar deneyin veya destek ekibiyle iletişime geçin.';
  }
  const message = error instanceof Error ? error.message : 'Kod gönderilemedi.';
  if (message.toLowerCase().includes('phone number')) {
    return 'Lütfen geçerli bir telefon numarası girin.';
  }
  if (/^tenant_onboarding_phone_(send|resend)_failed_/i.test(message) || message === 'phone_code_request_failed') {
    return 'Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.';
  }
  return message;
}

export function PhoneVerificationStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: PhoneVerificationStepProps) {
  const [phoneNumber, setPhoneNumber] = useState(() => getSeedPhone(workspace));
  const [challenge, setChallenge] = useState<TenantPhoneVerificationChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const canSend = phoneNumber.trim().length >= 7 && !sending;
  const initialMaskedPhone = workspace.phoneVerification?.maskedPhoneNumber;
  const showDebugCode = challenge?.debugCode && process.env.NODE_ENV !== 'production';
  const runOnce = useOnboardingActionGuard();

  const status = useMemo(() => {
    if (workspace.phoneVerification?.verified) return 'completed';
    if (workspace.phoneVerification?.pending || challenge) return 'in_progress';
    return 'not_started';
  }, [challenge, workspace.phoneVerification?.pending, workspace.phoneVerification?.verified]);

  async function sendCode() {
    if (!canSend) {
      setError('Lütfen telefon numaranızı kontrol edin.');
      return;
    }

    await runOnce(async () => {
      let navigating = false;
      setSending(true);
      setError(null);
      try {
        const result = await sendTenantOnboardingPhoneCode(workspace.stateToken, phoneNumber.trim());
        setChallenge(result);
        if (result.session?.workspace) {
          onWorkspaceResolved(result.session.workspace);
        }
        const nextStep = result.redirectStep ?? result.nextStep ?? 'otp';
        navigating = true;
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (sendError) {
        setError(formatSendError(sendError));
      } finally {
        if (!navigating) {
          setSending(false);
        }
      }
    });
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={0}
        totalSteps={0}
        status={status}
        updatedAt={workspace.application.updatedAt}
        title="Telefon doğrulama"
        description="Başvuruya devam edebilmek için iletişim numaranızı onaylayın. Kod başarıyla oluşturulduktan sonra doğrulama adımına geçeceksiniz."
      />

      <div className="grid gap-5">
        <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[14px] leading-6 text-primary-700">
          {challenge ? (
            <span>
              Kod {challenge.maskedPhoneNumber} numarası için gönderildi. Geçerlilik:{' '}
              {new Date(challenge.expiresAt).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              })}.
            </span>
          ) : initialMaskedPhone ? (
            <span>Son kod hedefi: {initialMaskedPhone}. Numarayı değiştirip yeni kod isteyebilirsiniz.</span>
          ) : (
            <span>Kayıt sırasında verilen telefon numarası otomatik doldurulur; gerekiyorsa düzeltebilirsiniz.</span>
          )}
        </div>

        {showDebugCode ? (
          <div className="rounded-[8px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-3 text-[13px] text-[#b54708]">
            Geliştirme test kodu: <strong>{challenge.debugCode}</strong>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-ink-700">Telefon numarası</span>
          <Input
            inputMode="tel"
            autoComplete="tel"
            placeholder="+41 79 123 45 67"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            disabled={sending || workspace.phoneVerification?.verified}
          />
          <span className="mt-2 block text-[12px] leading-5 text-ink-500">
            SMS entegrasyonu bağlanana kadar kod geliştirme amaçlı mevcut e-posta/log yöntemiyle üretilir.
          </span>
        </label>
      </div>

      <OnboardingBottomActionBar
        primaryLabel={resolvedSession?.redirectStep ? 'Yönlendiriliyor' : 'Kod gönder'}
        onPrimary={() => void sendCode()}
        primaryDisabled={!canSend || Boolean(resolvedSession?.redirectStep)}
        primaryLoading={sending}
      />
    </Card>
  );
}
