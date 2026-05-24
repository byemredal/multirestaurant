'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@lieferzonen/ui';
import { Input } from '@lieferzonen/ui';
import { Select } from '@lieferzonen/ui';
import { Textarea } from '@lieferzonen/ui';
import { FileDropzone } from '@lieferzonen/ui';
import { useWebLanguage } from '@/lib/i18n/WebLanguageProvider';
import {
  sendTenantOnboardingPhoneVerification,
  verifyTenantOnboardingPhone,
} from '@/lib/tenant-onboarding-client';
import type {
  TenantBusinessInfoInput,
  TenantLegalTaxInfoInput,
  TenantOnboardingDocument,
  TenantOnboardingStepKey,
  TenantOnboardingWorkspace,
  TenantOperationsInfoInput,
  TenantOwnerContactInfoInput,
  UploadTenantOnboardingDocumentInput,
} from '@/lib/tenant-onboarding-client';
import {
  getBackendStepForWorkflowStep,
  tenantOnboardingProgressStepOrder,
  tenantOnboardingWorkflowStepOrder,
  type TenantOnboardingWorkflowStepKey,
} from './onboarding-routing';
import { FieldError } from './shared/FieldError';
import { RevisionAlert } from './shared/RevisionAlert';
import { StepFooter } from './shared/StepFooter';
import { StepHeader } from './shared/StepHeader';
import { ValidationBanner } from './shared/ValidationBanner';
import { useFieldErrors } from './hooks/useFieldErrors';
import { useHydratedBusinessForm } from './hooks/useHydratedBusinessForm';
import { useHydratedLegalForm } from './hooks/useHydratedLegalForm';
import { useHydratedOperationsForm } from './hooks/useHydratedOperationsForm';
import { useHydratedOwnerForm } from './hooks/useHydratedOwnerForm';

const APP_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  under_review: 'İncelemede',
  revision_required: 'Revizyon Gerekli',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  active: 'Aktif',
  suspended: 'Askıya Alındı',
};

const DOC_STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  revision_requested: 'Revizyon İstendi',
  expired: 'Süresi Doldu',
};

type StepPanelProps = {
  activeStep: TenantOnboardingWorkflowStepKey;
  onContinue: () => void;
  onBack: () => void;
  onComplete: (step: TenantOnboardingStepKey) => Promise<unknown>;
  onPhoneVerified: (workspace: TenantOnboardingWorkspace) => void;
  onSaveDraft: (
    step: Exclude<TenantOnboardingStepKey, 'documents' | 'final_review'>,
    payload:
      | TenantBusinessInfoInput
      | TenantLegalTaxInfoInput
      | TenantOwnerContactInfoInput
      | TenantOperationsInfoInput,
  ) => Promise<unknown>;
  onSubmit: () => Promise<unknown>;
  onUploadDocument: (file: File, payload: UploadTenantOnboardingDocumentInput) => Promise<unknown>;
  savingStep: TenantOnboardingStepKey | null;
  workspace: TenantOnboardingWorkspace;
};

function SignupSummaryCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string | null | undefined }>;
}) {
  const visibleRows = rows.filter((row) => Boolean(row.value && String(row.value).trim()));
  if (visibleRows.length === 0) return null;
  return (
    <div className="mb-5 rounded-[14px] border border-[#e6dfd4] bg-[#fffbf5] px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a8a29e]">{title}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {visibleRows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="text-[11px] uppercase tracking-[0.08em] text-[#a8a29e]">{row.label}</dt>
            <dd className="text-[14px] font-medium text-[#1c1917]">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-[#a8a29e]">
        Kayıt sırasında verdiğiniz bilgiler. Düzeltmek için destek ekibiyle iletişime geçin.
      </p>
    </div>
  );
}

function DocumentsList({ documents }: { documents: TenantOnboardingDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-[#ece2d2] bg-[#fffbf5] px-4 py-5 text-[14px] text-[#78716c]">
        Henüz belge yüklenmedi.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {documents.map((document) => (
        <div
          key={document.id}
          className="rounded-[18px] border border-[#e6ded3] bg-[#fffbf5] px-4 py-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold text-[#1c1917]">{document.type}</div>
              <div className="mt-1 text-[13px] text-[#78716c]">
                Sürüm {document.version} ·{' '}
                {DOC_STATUS_LABELS[document.status] ?? document.status}
              </div>
            </div>
            <div className="text-[12px] text-[#7a8793]">
              Yüklendi: {new Date(document.uploadedAt).toLocaleString('tr-TR')}
            </div>
          </div>
          {document.rejectionReason ? (
            <div className="mt-3 rounded-[14px] bg-[#fff1f0] px-3 py-2 text-[13px] text-[#b42318]">
              {document.rejectionReason}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function sanitizeOptional(v: string | null | undefined): string | undefined {
  if (v === null || v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}

function formatPhoneVerificationError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('invalid phone verification code') ||
    normalized.includes('tenant_onboarding_phone_verify_failed_400')
  ) {
    return 'Kod dogrulanamadi. Lutfen gonderilen 6 haneli kodu kontrol edin.';
  }
  if (normalized.includes('expired')) {
    return 'Kodun suresi doldu. Lutfen yeni kod isteyin.';
  }
  if (normalized.includes('attempts exceeded')) {
    return 'Cok fazla hatali deneme yapildi. Lutfen yeni kod isteyin.';
  }
  return message;
}

function validateBusiness(form: TenantBusinessInfoInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.businessName?.trim()) errors.businessName = 'İşletme adı zorunludur.';
  if (!form.businessType?.trim()) errors.businessType = 'İşletme türü zorunludur.';
  if (!form.addressLine1?.trim()) errors.addressLine1 = 'Adres satırı 1 zorunludur.';
  if (!form.city?.trim()) errors.city = 'Şehir zorunludur.';
  if (!form.postalCode?.trim()) errors.postalCode = 'Posta kodu zorunludur.';
  if (!form.country?.trim()) errors.country = 'Ülke kodu zorunludur.';
  return errors;
}

function validateLegal(form: TenantLegalTaxInfoInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.legalEntityName?.trim()) errors.legalEntityName = 'Tüzel kişilik adı zorunludur.';
  if (!form.registrationCountry?.trim())
    errors.registrationCountry = 'Tescil ülkesi zorunludur.';
  if (!form.registeredAddress?.trim()) errors.registeredAddress = 'Tescilli adres zorunludur.';
  return errors;
}

function validateOwner(form: TenantOwnerContactInfoInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.fullName?.trim()) errors.fullName = 'Yetkili ad soyad zorunludur.';
  if (!form.email?.trim()) errors.email = 'Yetkili e-posta zorunludur.';
  if (!form.phoneNumber?.trim()) errors.phoneNumber = 'Yetkili telefon zorunludur.';
  return errors;
}

function validateOps(form: TenantOperationsInfoInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.primaryCity?.trim()) errors.primaryCity = 'Birincil şehir zorunludur.';
  if (!form.primaryPostalCode?.trim()) errors.primaryPostalCode = 'Posta kodu zorunludur.';
  if (!form.deliveryModel?.trim()) errors.deliveryModel = 'Teslimat modeli zorunludur.';
  return errors;
}

export function TenantOnboardingStepPanel({
  activeStep,
  onContinue,
  onBack,
  onComplete,
  onPhoneVerified,
  onSaveDraft,
  onSubmit,
  onUploadDocument,
  savingStep,
  workspace,
}: StepPanelProps) {
  const { t } = useWebLanguage();
  const activeBackendStep = getBackendStepForWorkflowStep(activeStep);
  const activeEntry = useMemo(
    () =>
      activeBackendStep
        ? workspace.steps.find((step) => step.stepKey === activeBackendStep)
        : undefined,
    [activeBackendStep, workspace.steps],
  );

  // Form state is hydrated from the workspace by small per-shape hooks.
  const [businessForm, setBusinessForm] = useHydratedBusinessForm(workspace);
  const [legalForm, setLegalForm] = useHydratedLegalForm(workspace);
  const [ownerForm, setOwnerForm] = useHydratedOwnerForm(workspace);
  const [operationsForm, setOperationsForm] = useHydratedOperationsForm(workspace);

  const [documentForm, setDocumentForm] = useState<UploadTenantOnboardingDocumentInput>({
    type: 'business_license',
    isRequired: true,
    expiresAt: '',
  });
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);

  // Per-step validation errors. Auto-clears whenever activeStep changes.
  const { errors: fieldErrors, setErrors: setFieldErrors } = useFieldErrors(activeStep);

  // Phone verification flow state — panel-local; will move when the
  // dedicated PhoneVerificationPanel is split out.
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneChallenge, setPhoneChallenge] = useState<{
    maskedPhoneNumber: string;
    expiresAt: string;
    debugCode?: string;
  } | null>(null);
  const [phoneVerificationError, setPhoneVerificationError] = useState<string | null>(null);
  const [phoneVerificationLoading, setPhoneVerificationLoading] = useState(false);

  // Mirror the owner-contact phone number into the verification field so
  // the OTP form pre-fills with whatever the tenant typed at landing.
  useEffect(() => {
    const ownerData = workspace.steps.find((s) => s.stepKey === 'owner_contact_info')
      ?.data as Record<string, unknown> | undefined;
    setPhoneNumber(
      String(ownerData?.phoneNumber ?? workspace.phoneVerification?.phoneNumber ?? ''),
    );
  }, [workspace]);

  const saving = activeBackendStep ? savingStep === activeBackendStep : false;
  const documents =
    (workspace.steps.find((s) => s.stepKey === 'documents')
      ?.data as TenantOnboardingDocument[] | undefined) ?? [];
  const locked = Boolean(activeEntry?.locked);
  const navigationStepIndex = Math.max(tenantOnboardingWorkflowStepOrder.indexOf(activeStep), 0);
  const stepIndex = Math.max(tenantOnboardingProgressStepOrder.indexOf(activeStep), 0);

  const businessSeed = workspace.steps.find((s) => s.stepKey === 'business_info')?.data as
    | Record<string, unknown>
    | undefined;
  const legalSeed = workspace.steps.find((s) => s.stepKey === 'legal_tax_info')?.data as
    | Record<string, unknown>
    | undefined;
  const opsSeed = workspace.steps.find((s) => s.stepKey === 'operations_info')?.data as
    | Record<string, unknown>
    | undefined;

  const businessIdentitySeeded = Boolean(
    businessSeed?.businessName &&
    String(businessSeed.businessName).trim() &&
    businessSeed?.addressLine1 &&
    String(businessSeed.addressLine1).trim(),
  );
  const legalEntitySeeded = Boolean(
    legalSeed?.legalEntityName &&
    String(legalSeed.legalEntityName).trim() &&
    legalSeed?.registeredAddress &&
    String(legalSeed.registeredAddress).trim(),
  );
  const deliveryModelSeeded = Boolean(
    opsSeed?.deliveryModel && String(opsSeed.deliveryModel).trim(),
  );
  const isInformationalStep = activeStep === 'welcome' || activeStep === 'business-intro';
  const totalSteps = isInformationalStep ? 0 : tenantOnboardingProgressStepOrder.length;
  const isFirstStep = navigationStepIndex <= 0;
  const panelClass = 'border-0 bg-white p-0 shadow-none';

  async function saveStepAndAdvance(
    step: Exclude<TenantOnboardingStepKey, 'documents' | 'final_review'>,
    payload:
      | TenantBusinessInfoInput
      | TenantLegalTaxInfoInput
      | TenantOwnerContactInfoInput
      | TenantOperationsInfoInput,
  ) {
    await onSaveDraft(step, payload);
    await onComplete(step);
  }

  async function saveDocumentAndAdvance() {
    if (!selectedDocumentFile) {
      throw new Error('Lütfen önce bir belge dosyası seçin.');
    }
    await onUploadDocument(selectedDocumentFile, {
      ...documentForm,
      isRequired: true,
      expiresAt: documentForm.expiresAt?.trim() ? documentForm.expiresAt : undefined,
    });
    onContinue();
  }

  async function sendPhoneCode() {
    setPhoneVerificationLoading(true);
    setPhoneVerificationError(null);
    try {
      const challenge = await sendTenantOnboardingPhoneVerification(
        workspace.stateToken,
        phoneNumber.trim(),
      );
      setPhoneChallenge(challenge);
      if (challenge.debugCode) {
        setPhoneCode(challenge.debugCode);
      }
    } catch (error) {
      setPhoneVerificationError(error instanceof Error ? error.message : 'Kod gonderilemedi.');
    } finally {
      setPhoneVerificationLoading(false);
    }
  }

  async function verifyPhoneCode() {
    setPhoneVerificationLoading(true);
    setPhoneVerificationError(null);
    try {
      const result = await verifyTenantOnboardingPhone(workspace.stateToken, phoneCode.trim());
      onPhoneVerified(result.workspace);
      onContinue();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kod dogrulanamadi.';
      setPhoneVerificationError(formatPhoneVerificationError(message));
    } finally {
      setPhoneVerificationLoading(false);
    }
  }

  function updateOtpDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = phoneCode.padEnd(6, ' ').split('');
    nextDigits[index] = digit || ' ';
    setPhoneCode(nextDigits.join('').replace(/\s/g, '').slice(0, 6));
  }

  function pasteOtp(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (digits) {
      setPhoneCode(digits);
    }
  }

  async function completePlanSelection() {
    const payload: TenantOperationsInfoInput = {
      ...operationsForm,
      primaryCity: operationsForm.primaryCity?.trim() || businessForm.city?.trim() || '',
      primaryPostalCode:
        operationsForm.primaryPostalCode?.trim() || businessForm.postalCode?.trim() || '',
      deliveryModel: operationsForm.deliveryModel?.trim() || 'platform_fleet',
      openingHoursSummary: sanitizeOptional(operationsForm.openingHoursSummary),
      estimatedGoLiveDate: sanitizeOptional(operationsForm.estimatedGoLiveDate),
    };
    const errors = validateOps(payload);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    await saveStepAndAdvance('operations_info', payload);
  }

  if (activeBackendStep && !activeEntry) {
    return null;
  }

  if ((activeStep as string) === 'phone-verification') {
    const phoneVerified = Boolean(workspace.phoneVerification?.verified);
    const canSendPhoneCode = phoneNumber.trim().length >= 7;

    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status={phoneVerified ? 'completed' : 'in_progress'}
          updatedAt={workspace.application.updatedAt}
          title="Telefon dogrulama"
          description="Telefon numaranizi girin, gelen 6 haneli kodu kutulara yazin. Onay tamamlanmadan sonraki adima gecilemez."
        />
        <div className="grid gap-4">
          <div className="rounded-[18px] border border-primary-100 bg-primary-50 px-4 py-4 text-[14px] text-primary-700">
            {phoneVerified ? (
              `Telefon onaylandi: ${workspace.phoneVerification?.phoneNumber ?? phoneNumber}`
            ) : phoneChallenge ? (
              <div className="grid gap-2">
                <span>
                  {`Kod ${phoneChallenge.maskedPhoneNumber} numarasi icin olusturuldu. Gecerlilik: ${new Date(phoneChallenge.expiresAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}.`}
                </span>
                {phoneChallenge.debugCode ? (
                  <span className="font-semibold text-primary-800">
                    Test kodu otomatik dolduruldu: {phoneChallenge.debugCode}
                  </span>
                ) : null}
              </div>
            ) : (
              'SMS provider baglanana kadar kod e-posta log transportu uzerinden uretilir. UI gercek OTP akisina hazirdir.'
            )}
          </div>

          {phoneVerificationError && (
            <div className="rounded-[14px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
              {phoneVerificationError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Input
                disabled={phoneVerified}
                inputMode="tel"
                placeholder="+49 170 1234567"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
              <p className="mt-1 text-[12px] text-ink-500">SMS kodu bu numaraya gonderilecek.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void sendPhoneCode()}
              disabled={phoneVerificationLoading || phoneVerified || !canSendPhoneCode}
              className="rounded-[14px] px-4 py-2.5 text-[14px] font-semibold"
            >
              {phoneChallenge ? 'Kodu yeniden gonder' : 'Kodu gonder'}
            </Button>
          </div>

          <div className="grid grid-cols-6 gap-2 sm:max-w-[360px]">
            {Array.from({ length: 6 }).map((_, index) => (
              <input
                key={index}
                aria-label={`OTP ${index + 1}`}
                className="h-12 rounded-[12px] border border-ink-200 bg-white text-center text-[20px] font-bold text-ink-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-ink-50 disabled:text-ink-400"
                disabled={phoneVerified}
                inputMode="numeric"
                maxLength={1}
                value={phoneCode[index] ?? ''}
                onChange={(event) => updateOtpDigit(index, event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  pasteOtp(event.clipboardData.getData('text'));
                }}
              />
            ))}
          </div>
        </div>
        <StepFooter
          showBack={!isFirstStep}
          onBack={onBack}
          onSave={() => (phoneVerified ? onContinue() : void verifyPhoneCode())}
          saving={phoneVerificationLoading}
          disableSave={!phoneVerified && phoneCode.length !== 6}
          primaryLabel={phoneVerified ? 'Devam et' : 'Dogrula ve devam et'}
        />
      </Card>
    );
  }

  if (activeStep === 'welcome') {
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status="in_progress"
          updatedAt={workspace.application.updatedAt}
          title="Lieferzonen başvurunuza hoş geldiniz"
          description="Bu akış işletme konumunuzu, yasal bilgileri, paket seçimini ve doğrulama hazırlığını tek tek tamamlatır."
        />
        <div className="grid gap-3 text-[14px] text-[#586575] sm:grid-cols-3">
          {['Temel bilgiler', 'Doğrulama hazırlığı', 'İnceleme takibi'].map((item) => (
            <div key={item} className="rounded-[16px] border border-[#ece2d2] bg-[#fffbf5] px-4 py-4">
              <p className="font-semibold text-[#1c1917]">{item}</p>
            </div>
          ))}
        </div>
        <StepFooter showBack={false} onBack={onBack} onSave={onContinue} saving={false} primaryLabel="Başlayalım" />
      </Card>
    );
  }

  if (activeStep === 'business-intro') {
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status="in_progress"
          updatedAt={workspace.application.updatedAt}
          title="Sizden neler bekliyoruz?"
          description="Başvuruyu hızlı tamamlamak için işletme adresi, vergi bilgisi, banka bilgileri ve doğrulama belgelerini hazır tutun."
        />
        <div className="grid gap-3">
          {[
            'İşletme konumu ve açık adres',
            'Vergi numarası ve tüzel kişilik bilgileri',
            'IBAN ve fatura adresi',
            'İnceleme için belge gereksinimleri',
          ].map((item) => (
            <div key={item} className="rounded-[16px] border border-[#ece2d2] px-4 py-3 text-[14px] text-[#44403c]">
              {item}
            </div>
          ))}
        </div>
        <StepFooter showBack={!isFirstStep} onBack={onBack} onSave={onContinue} saving={false} primaryLabel="Bilgileri doldur" />
      </Card>
    );
  }

  if (activeStep === 'bank-details') {
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status="in_progress"
          updatedAt={workspace.application.updatedAt}
          title="Banka ve fatura bilgileri"
          description="Bu MVP adımı ödeme altyapısına hazır bir veri modeli için ayrıldı. Gerçek banka kaydı API'si bağlandığında bu alanlar kalıcı hale gelecek."
        />
        <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2">
          <Input placeholder="Banka adı" disabled />
          <Input placeholder="IBAN" disabled />
          <Textarea className="md:col-span-2" placeholder="Fatura adresi" disabled />
        </fieldset>
        <StepFooter showBack={!isFirstStep} onBack={onBack} onSave={onContinue} saving={false} primaryLabel="Şimdilik atla" />
      </Card>
    );
  }

  if (activeStep === 'plan-selection') {
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status={activeEntry?.status ?? 'in_progress'}
          updatedAt={activeEntry?.updatedAt ?? workspace.application.updatedAt}
          title="Paket seçimi"
          description="MVP için statik paket seçenekleri. Ticari paketler ileride fiyatlandırma servisine bağlanacak."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['Starter', 'Yeni başlayan işletmeler için temel vitrin.'],
            ['Growth', 'Daha yüksek görünürlük ve operasyon desteği.'],
            ['Partner', 'Çok şubeli işletmeler için özel destek.'],
          ].map(([title, body], index) => (
            <button
              key={title}
              type="button"
              className={`rounded-[18px] border px-4 py-5 text-left transition ${
                index === 0 ? 'border-[#f97316] bg-[#fff7ed]' : 'border-[#ece2d2] bg-white hover:bg-[#fffbf5]'
              }`}
            >
              <p className="text-[16px] font-semibold text-[#1c1917]">{title}</p>
              <p className="mt-2 text-[13px] leading-5 text-[#586575]">{body}</p>
            </button>
          ))}
        </div>
        <StepFooter
          showBack={!isFirstStep}
          onBack={onBack}
          onSave={() => void completePlanSelection()}
          saving={saving}
          primaryLabel="Starter ile devam et"
        />
      </Card>
    );
  }

  if (activeStep === 'verification') {
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status={activeEntry?.status ?? 'in_progress'}
          updatedAt={activeEntry?.updatedAt ?? workspace.application.updatedAt}
          title="Belgeler"
          description="Inceleme icin en az bir gerekli belge yukleyin. Yukleme tamamlandiginda dogrulama adimi tamamlanir."
        />
        {activeEntry?.status === 'needs_revision' && <RevisionAlert />}
        <fieldset disabled={locked} className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2">
          <Select
            value={documentForm.type}
            onChange={(e) => setDocumentForm((current) => ({ ...current, type: e.target.value }))}
          >
            <option value="business_license">Ticaret lisansi</option>
            <option value="tax_certificate">Vergi belgesi</option>
            <option value="identity_document">Yetkili kimligi</option>
            <option value="bank_statement">Banka kaniti</option>
            <option value="food_safety_certificate">Gida guvenligi belgesi</option>
          </Select>
          <Input
            type="date"
            value={documentForm.expiresAt ?? ''}
            onChange={(e) =>
              setDocumentForm((current) => ({ ...current, expiresAt: e.target.value }))
            }
          />
        </fieldset>
        <FileDropzone
          accept=".pdf,.jpg,.jpeg,.png"
          maxSizeMb={10}
          file={selectedDocumentFile}
          onFile={setSelectedDocumentFile}
          disabled={locked}
          className="mt-4"
        />
        <div className="mt-6">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-ink-400">
            Yuklenen belgeler
          </p>
          <DocumentsList documents={documents} />
        </div>
        <StepFooter
          disableSave={locked || !selectedDocumentFile}
          showBack={!isFirstStep}
          onBack={onBack}
          onSave={() => void saveDocumentAndAdvance()}
          saving={saving}
          primaryLabel="Belgeyi yukle ve devam et"
        />
      </Card>
    );
  }

  if (activeStep === 'location') {
    const err = fieldErrors;
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status={activeEntry.status}
          updatedAt={activeEntry.updatedAt}
          title={t('tenant.onboarding.businessInfo.title', 'İşletme Bilgileri')}
          description={t(
            'tenant.onboarding.businessInfo.description',
            'Adres detayları ve isteğe bağlı tescil bilgileri.',
          )}
        />
        {activeEntry.status === 'needs_revision' && <RevisionAlert />}
        <ValidationBanner errors={err} />
        {businessIdentitySeeded && (
          <SignupSummaryCard
            title="Kayıt bilgileri"
            rows={[
              { label: 'İşletme adı', value: businessForm.businessName },
              { label: 'Ana adres', value: businessForm.addressLine1 },
            ]}
          />
        )}
        <fieldset
          disabled={locked}
          className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2"
        >
          {!businessIdentitySeeded && (
            <div>
              <Input
                className={err.businessName ? 'border-[#fda29b]' : ''}
                placeholder="İşletme adı"
                value={businessForm.businessName ?? ''}
                onChange={(e) => setBusinessForm((c) => ({ ...c, businessName: e.target.value }))}
              />
              <FieldError errors={err} name="businessName" />
            </div>
          )}
          <div>
            <Input
              className={err.businessType ? 'border-[#fda29b]' : ''}
              placeholder="İşletme türü (örn: Restoran, Market)"
              value={businessForm.businessType ?? ''}
              onChange={(e) => setBusinessForm((c) => ({ ...c, businessType: e.target.value }))}
            />
            <FieldError errors={err} name="businessType" />
          </div>
          <Input
            placeholder="Tescil numarası (isteğe bağlı)"
            value={businessForm.registrationNumber ?? ''}
            onChange={(e) =>
              setBusinessForm((c) => ({ ...c, registrationNumber: e.target.value }))
            }
          />
          <Input
            placeholder="Vergi numarası (isteğe bağlı)"
            value={businessForm.taxNumber ?? ''}
            onChange={(e) => setBusinessForm((c) => ({ ...c, taxNumber: e.target.value }))}
          />
          {!businessIdentitySeeded && (
            <div className="md:col-span-2">
              <Input
                className={err.addressLine1 ? 'border-[#fda29b]' : ''}
                placeholder="Adres satırı 1"
                value={businessForm.addressLine1 ?? ''}
                onChange={(e) => setBusinessForm((c) => ({ ...c, addressLine1: e.target.value }))}
              />
              <FieldError errors={err} name="addressLine1" />
            </div>
          )}
          <Input
            className="md:col-span-2"
            placeholder="Adres satırı 2 (isteğe bağlı)"
            value={businessForm.addressLine2 ?? ''}
            onChange={(e) => setBusinessForm((c) => ({ ...c, addressLine2: e.target.value }))}
          />
          <div>
            <Input
              className={err.city ? 'border-[#fda29b]' : ''}
              placeholder="Şehir"
              value={businessForm.city ?? ''}
              onChange={(e) => setBusinessForm((c) => ({ ...c, city: e.target.value }))}
            />
            <FieldError errors={err} name="city" />
          </div>
          <div>
            <Input
              className={err.postalCode ? 'border-[#fda29b]' : ''}
              placeholder="Posta kodu"
              value={businessForm.postalCode ?? ''}
              onChange={(e) => setBusinessForm((c) => ({ ...c, postalCode: e.target.value }))}
            />
            <FieldError errors={err} name="postalCode" />
          </div>
          <div>
            <Input
              className={err.country ? 'border-[#fda29b]' : ''}
              placeholder="Ülke kodu (örn: CH, DE)"
              value={businessForm.country ?? ''}
              onChange={(e) => setBusinessForm((c) => ({ ...c, country: e.target.value }))}
            />
            <FieldError errors={err} name="country" />
          </div>
        </fieldset>
        <StepFooter
          disableSave={locked}
          showBack={!isFirstStep}
          onBack={onBack}
          onSave={() => {
            const errors = validateBusiness(businessForm);
            if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
            setFieldErrors({});
            void saveStepAndAdvance('business_info', {
              ...businessForm,
              registrationNumber: sanitizeOptional(businessForm.registrationNumber),
              taxNumber: sanitizeOptional(businessForm.taxNumber),
              addressLine2: sanitizeOptional(businessForm.addressLine2),
            });
          }}
          saving={saving}
        />
      </Card>
    );
  }

  // ── Legal & tax info ───────────────────────────────────────────────────────
  if (activeStep === 'business-details') {
    const err = fieldErrors;
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status={activeEntry.status}
          updatedAt={activeEntry.updatedAt}
          title="Hukuki ve Vergi Bilgileri"
          description="İsteğe bağlı vergi kimlik numaralarınızı ekleyin."
        />
        {activeEntry.status === 'needs_revision' && <RevisionAlert />}
        <ValidationBanner errors={err} />
        {legalEntitySeeded && (
          <SignupSummaryCard
            title="Tüzel kişilik"
            rows={[
              { label: 'Tüzel kişilik adı', value: legalForm.legalEntityName },
              { label: 'Tescilli adres', value: legalForm.registeredAddress },
              {
                label: 'Tescil ülkesi',
                value:
                  legalForm.registrationCountry ||
                  (businessForm.country ? businessForm.country : ''),
              },
            ]}
          />
        )}
        <fieldset
          disabled={locked}
          className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2"
        >
          {!legalEntitySeeded && (
            <>
              <div>
                <Input
                  className={err.legalEntityName ? 'border-[#fda29b]' : ''}
                  placeholder="Tüzel kişilik adı"
                  value={legalForm.legalEntityName ?? ''}
                  onChange={(e) => setLegalForm((c) => ({ ...c, legalEntityName: e.target.value }))}
                />
                <FieldError errors={err} name="legalEntityName" />
              </div>
              <div>
                <Input
                  className={err.registrationCountry ? 'border-[#fda29b]' : ''}
                  placeholder="Tescil ülkesi (örn: CH, DE)"
                  value={legalForm.registrationCountry ?? ''}
                  onChange={(e) =>
                    setLegalForm((c) => ({ ...c, registrationCountry: e.target.value }))
                  }
                />
                <FieldError errors={err} name="registrationCountry" />
              </div>
            </>
          )}
          <Input
            placeholder="Vergi kimlik numarası (isteğe bağlı)"
            value={legalForm.taxId ?? ''}
            onChange={(e) => setLegalForm((c) => ({ ...c, taxId: e.target.value }))}
          />
          <Input
            placeholder="KDV numarası (isteğe bağlı)"
            value={legalForm.vatId ?? ''}
            onChange={(e) => setLegalForm((c) => ({ ...c, vatId: e.target.value }))}
          />
          {!legalEntitySeeded && (
            <div className="md:col-span-2">
              <Textarea
                className={err.registeredAddress ? 'border-[#fda29b]' : ''}
                placeholder="Tescilli adres"
                value={legalForm.registeredAddress ?? ''}
                onChange={(e) => setLegalForm((c) => ({ ...c, registeredAddress: e.target.value }))}
              />
              <FieldError errors={err} name="registeredAddress" />
            </div>
          )}
        </fieldset>
        <StepFooter
          disableSave={locked}
          showBack={!isFirstStep}
          onBack={onBack}
          onSave={() => {
            const merged: TenantLegalTaxInfoInput = {
              ...legalForm,
              registrationCountry:
                legalForm.registrationCountry?.trim() ||
                businessForm.country?.trim() ||
                '',
            };
            const errors = validateLegal(merged);
            if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
            setFieldErrors({});
            void saveStepAndAdvance('legal_tax_info', {
              ...merged,
              taxId: sanitizeOptional(merged.taxId),
              vatId: sanitizeOptional(merged.vatId),
            });
          }}
          saving={saving}
        />
      </Card>
    );
  }

  // Minimal V2 bridge: owner_contact_info is now its own canonical step.
  if (activeStep === 'authorized-person') {
    const err = fieldErrors;
    return (
      <Card className={panelClass}>
        <StepHeader
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          status={activeEntry.status}
          updatedAt={activeEntry.updatedAt}
          title="Yetkili kisi bilgileri"
          description="Basvurudan sorumlu yetkili kisi ve sahiplik bilgilerini tamamlayin."
        />
        {activeEntry.status === 'needs_revision' && <RevisionAlert />}
        <ValidationBanner errors={err} />
        <fieldset
          disabled={locked}
          className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2"
        >
          <div>
            <Input
              className={err.fullName ? 'border-[#fda29b]' : ''}
              placeholder="Yetkili ad soyad"
              value={ownerForm.fullName ?? ''}
              onChange={(e) => setOwnerForm((c) => ({ ...c, fullName: e.target.value }))}
            />
            <FieldError errors={err} name="fullName" />
          </div>
          <div>
            <Input
              className={err.email ? 'border-[#fda29b]' : ''}
              placeholder="Yetkili e-posta"
              type="email"
              value={ownerForm.email ?? ''}
              onChange={(e) => setOwnerForm((c) => ({ ...c, email: e.target.value }))}
            />
            <FieldError errors={err} name="email" />
          </div>
          <div>
            <Input
              className={err.phoneNumber ? 'border-[#fda29b]' : ''}
              inputMode="tel"
              placeholder="Yetkili telefon"
              value={ownerForm.phoneNumber ?? ''}
              onChange={(e) => setOwnerForm((c) => ({ ...c, phoneNumber: e.target.value }))}
            />
            <FieldError errors={err} name="phoneNumber" />
          </div>
          <Input
            placeholder="Unvan / rol (istege bagli)"
            value={ownerForm.roleTitle ?? ''}
            onChange={(e) => setOwnerForm((c) => ({ ...c, roleTitle: e.target.value }))}
          />
          <Input
            placeholder="Sahiplik orani % (istege bagli)"
            type="number"
            min={0}
            max={100}
            value={ownerForm.ownershipPercentage ?? ''}
            onChange={(e) =>
              setOwnerForm((c) => ({
                ...c,
                ownershipPercentage: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </fieldset>
        <StepFooter
          disableSave={locked}
          showBack={!isFirstStep}
          onBack={onBack}
          onSave={() => {
            const errors = validateOwner(ownerForm);
            if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
            setFieldErrors({});
            void saveStepAndAdvance('owner_contact_info', {
              ...ownerForm,
              roleTitle: sanitizeOptional(ownerForm.roleTitle),
            });
          }}
          saving={saving}
        />
      </Card>
    );
  }

  // ── Final review ───────────────────────────────────────────────────────────
  return (
    <Card className={panelClass}>
      <StepHeader
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        status={activeEntry.status}
        updatedAt={activeEntry.updatedAt}
        title="Son İnceleme ve Gönderim"
        description="Adımları kontrol edin ve başvurunuzu incelemeye gönderin."
      />
      <div className="grid gap-4">
        <div className="rounded-[18px] bg-[#fffbf5] px-4 py-4 text-[14px] text-[#44403c]">
          <div>
            Başvuru durumu:{' '}
            <strong>
              {APP_STATUS_LABELS[workspace.application.status] ?? workspace.application.status}
            </strong>
          </div>
        </div>
        <div className="rounded-[18px] border border-[#ece2d2] px-4 py-4 text-[14px] text-[#586575]">
          {workspace.canSubmitForReview
            ? 'Tüm zorunlu adımlar hazır. Başvurunuzu incelemeye gönderebilirsiniz.'
            : 'Başvuruyu göndermeden önce tüm düzenlenebilir adımları tamamlayın ve en az bir zorunlu belge yükleyin.'}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1e8d6] pt-6">
        {!isFirstStep ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[14px] font-semibold text-[#44403c] transition hover:bg-[#fffbf5]"
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
            Geri
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving || !workspace.canSubmitForReview || locked}
            onClick={() => void onComplete('final_review')}
            className="inline-flex items-center rounded-[14px] border border-[#e7dfd3] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#44403c] transition hover:bg-[#fffbf5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor…' : 'Adımı tamamlandı işaretle'}
          </button>
          <button
            type="button"
            disabled={saving || !workspace.canSubmitForReview || !workspace.editable || locked}
            onClick={() => void onSubmit()}
            className="inline-flex items-center rounded-[14px] bg-[#f97316] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(249,115,22,0.25)] transition hover:bg-[#ea6a0d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? 'Gönderiliyor…'
              : workspace.submitAction === 'resubmit'
                ? 'Yeniden gönder'
                : 'İncelemeye gönder'}
          </button>
        </div>
      </div>
    </Card>
  );
}
