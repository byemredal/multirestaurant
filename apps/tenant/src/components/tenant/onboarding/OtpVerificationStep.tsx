'use client';

import { useMemo, useState } from 'react';
import { Card } from '@lieferzonen/ui';
import {
  resendTenantOnboardingPhoneCode,
  verifyTenantOnboardingPhoneCode,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
  type TenantPhoneVerificationChallenge,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type OtpVerificationStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

function formatVerifyError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid phone verification code') || normalized.includes('verify_failed_400')) {
    return 'Kod dogrulanamadi. Lutfen 6 haneli kodu kontrol edin.';
  }
  if (normalized.includes('expired')) {
    return 'Kodun suresi doldu. Lutfen yeni kod isteyin.';
  }
  if (normalized.includes('attempts exceeded')) {
    return 'Cok fazla hatali deneme yapildi. Lutfen yeni kod isteyin.';
  }
  return message;
}

export function OtpVerificationStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: OtpVerificationStepProps) {
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<TenantPhoneVerificationChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'verify' | 'resend' | null>(null);
  const maskedPhone = challenge?.maskedPhoneNumber ?? workspace.phoneVerification?.maskedPhoneNumber;
  const expiresAt = challenge?.expiresAt ?? workspace.phoneVerification?.expiresAt;
  const showDebugCode = challenge?.debugCode && process.env.NODE_ENV !== 'production';
  const verifying = busyAction === 'verify';
  const resending = busyAction === 'resend';
  const runOnce = useOnboardingActionGuard();

  const digits = useMemo(() => code.padEnd(6, ' ').split(''), [code]);

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[index] = digit || ' ';
    setCode(next.join('').replace(/\s/g, '').slice(0, 6));
  }

  function pasteCode(value: string) {
    const pasted = value.replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      setCode(pasted);
    }
  }

  async function resendCode() {
    await runOnce(async () => {
      setBusyAction('resend');
      setError(null);
      try {
        const result = await resendTenantOnboardingPhoneCode(
          workspace.stateToken,
          workspace.phoneVerification?.phoneNumber ?? undefined,
        );
        setChallenge(result);
        if (result.debugCode) {
          setCode(result.debugCode);
        }
        if (result.session?.workspace) {
          onWorkspaceResolved(result.session.workspace);
        }
      } catch (resendError) {
        const message = resendError instanceof Error ? resendError.message : 'Kod yeniden gonderilemedi.';
        setError(message);
      } finally {
        setBusyAction(null);
      }
    });
  }

  async function verifyCode() {
    if (code.length !== 6) {
      setError('Lutfen 6 haneli kodu girin.');
      return;
    }

    await runOnce(async () => {
      let navigating = false;
      setBusyAction('verify');
      setError(null);
      try {
        const result = await verifyTenantOnboardingPhoneCode(workspace.stateToken, code);
        onWorkspaceResolved(result.workspace);
        const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'welcome';
        navigating = true;
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (verifyError) {
        const message = verifyError instanceof Error ? verifyError.message : 'Kod dogrulanamadi.';
        setError(formatVerifyError(message));
      } finally {
        if (!navigating) {
          setBusyAction(null);
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
        title="Dogrulama kodunu girin"
        description="Telefonunuza gonderilen 6 haneli kodu girin. Kod dogrulanmadan sonraki adimlar acilmaz."
      />

      <div className="grid gap-5">
        <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[14px] leading-6 text-primary-700">
          {maskedPhone ? <span>Kod hedefi: {maskedPhone}.</span> : <span>Kod daha once sectiginiz telefon numarasina gonderildi.</span>}
          {expiresAt ? (
            <span>
              {' '}Gecerlilik:{' '}
              {new Date(expiresAt).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              })}.
            </span>
          ) : null}
        </div>

        {showDebugCode ? (
          <div className="rounded-[8px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-3 text-[13px] text-[#b54708]">
            Development test kodu: <strong>{challenge.debugCode}</strong>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        <div className="grid max-w-[420px] grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <input
              key={index}
              aria-label={`OTP ${index + 1}`}
              className="h-12 rounded-[6px] border border-ink-200 bg-white text-center text-[20px] font-bold text-ink-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-ink-50 disabled:text-ink-400 sm:h-14"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : undefined}
              maxLength={1}
              value={digits[index] === ' ' ? '' : digits[index]}
              disabled={Boolean(busyAction)}
              onChange={(event) => updateDigit(index, event.target.value)}
              onPaste={(event) => {
                event.preventDefault();
                pasteCode(event.clipboardData.getData('text'));
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => void resendCode()}
          disabled={Boolean(busyAction)}
          className="w-fit text-[13px] font-semibold text-primary-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? 'Yeni kod gonderiliyor...' : 'Kodu yeniden gonder'}
        </button>
      </div>

      <OnboardingBottomActionBar
        primaryLabel="Dogrula ve devam et"
        onPrimary={() => void verifyCode()}
        primaryDisabled={code.length !== 6 || Boolean(resolvedSession?.redirectStep)}
        primaryLoading={verifying}
        secondaryLabel="Telefonu degistir"
        onSecondary={() => onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, 'phone-verification'))}
      />
    </Card>
  );
}
