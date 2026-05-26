'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@lieferzonen/ui';
import {
  getTenantOnboardingReview,
  saveTenantOnboardingConsents,
  submitTenantOnboardingByStateToken,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingReviewBlockKey,
  type TenantOnboardingReviewResult,
  type TenantOnboardingSessionStepKey,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getReviewCopy } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type ReviewStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type ReviewRow = { label: string; value: string | null | undefined };
type ReviewBlock = {
  key: TenantOnboardingReviewBlockKey | 'remaining-requirements';
  title: string;
  editStep?: TenantOnboardingSessionStepKey;
  returnToReview?: boolean;
  missingKeys: TenantOnboardingReviewBlockKey[];
  rows: ReviewRow[];
};

const MISSING_LABELS: Partial<Record<TenantOnboardingReviewBlockKey, string>> = {
  'phone-verification': 'İletişim doğrulaması',
  location: 'Konum',
  address: 'İşletme adresi',
  'business-details': 'İşletme detayları',
  'authorized-person': 'Yetkili kişi',
  'bank-details': 'Banka bilgileri',
  'billing-address': 'Fatura adresi',
  'plan-selection': 'Plan seçimi',
  'operations-info': 'Operasyon bilgileri',
  documents: 'Zorunlu belgeler',
  consents: 'Zorunlu onaylar',
};

function valueOrMissing(value: unknown) {
  const display = value === null || value === undefined ? '' : String(value).trim();
  return display || 'Eksik';
}

function buildBlocks(result: TenantOnboardingReviewResult): ReviewBlock[] {
  const summary = result.summary;
  if (!summary) {
    return [];
  }

  return [
    {
      key: 'phone-verification',
      title: 'İletişim / telefon doğrulaması',
      editStep: result.editSteps.phone,
      missingKeys: ['phone-verification'],
      rows: [
        { label: 'Telefon', value: summary.phoneVerification.maskedPhoneNumber },
        { label: 'Doğrulama', value: summary.phoneVerification.verified ? 'Doğrulandı' : null },
      ],
    },
    {
      key: 'location',
      title: 'Konum seçimi',
      editStep: result.editSteps.location,
      missingKeys: ['location'],
      rows: [
        { label: 'Seçilen konum', value: summary.locationSelection?.locationLabel },
        { label: 'Ülke', value: summary.locationSelection?.country },
      ],
    },
    {
      key: 'address',
      title: 'İşletme adresi',
      editStep: result.editSteps.address,
      missingKeys: ['address'],
      rows: [
        { label: 'İşletme adı', value: summary.businessInfo?.businessName },
        { label: 'Adres', value: summary.businessInfo?.addressLine1 },
        {
          label: 'Şehir / posta kodu',
          value: [summary.businessInfo?.postalCode, summary.businessInfo?.city].filter(Boolean).join(' '),
        },
        { label: 'Ülke', value: summary.businessInfo?.country },
      ],
    },
    {
      key: 'business-details',
      title: 'Ticari / hukuki / vergi bilgileri',
      editStep: result.editSteps.businessDetails,
      missingKeys: ['business-details'],
      rows: [
        { label: 'Kayıtlı unvan', value: summary.legalTaxInfo?.legalEntityName },
        { label: 'Vergi referansı', value: summary.legalTaxInfo?.taxId },
        { label: 'KDV referansı', value: summary.legalTaxInfo?.vatId },
        { label: 'Kayıt ülkesi', value: summary.legalTaxInfo?.registrationCountry },
      ],
    },
    {
      key: 'authorized-person',
      title: 'Yetkili kişi',
      editStep: result.editSteps.authorizedPerson,
      missingKeys: ['authorized-person'],
      rows: [
        { label: 'Ad soyad', value: summary.ownerContactInfo?.fullName },
        { label: 'E-posta', value: summary.ownerContactInfo?.email },
        { label: 'Telefon', value: summary.ownerContactInfo?.phoneNumber },
        { label: 'Görev', value: summary.ownerContactInfo?.roleTitle },
      ],
    },
    {
      key: 'bank-details',
      title: 'Banka bilgileri',
      editStep: result.editSteps.bankDetails,
      missingKeys: ['bank-details'],
      rows: [
        { label: 'Banka', value: summary.bankDetails?.bankName },
        { label: 'Hesap sahibi', value: summary.bankDetails?.accountHolderName },
        { label: 'IBAN', value: summary.bankDetails?.maskedIban },
        { label: 'Para birimi', value: summary.bankDetails?.currency },
      ],
    },
    {
      key: 'billing-address',
      title: 'Fatura adresi',
      editStep: result.editSteps.billingAddress,
      missingKeys: ['billing-address'],
      rows: [
        { label: 'Fatura adı', value: summary.billingAddress?.billingName },
        { label: 'Adres', value: summary.billingAddress?.addressLine1 },
        {
          label: 'Şehir / posta kodu',
          value: [summary.billingAddress?.postalCode, summary.billingAddress?.city].filter(Boolean).join(' '),
        },
        { label: 'Ülke', value: summary.billingAddress?.country },
      ],
    },
    {
      key: 'plan-selection',
      title: 'Seçilen plan',
      editStep: result.editSteps.planSelection,
      missingKeys: ['plan-selection'],
      rows: [
        { label: 'Plan', value: summary.planSelection?.planNameSnapshot },
        { label: 'Ücret özeti', value: summary.planSelection?.commissionSummarySnapshot },
        { label: 'Para birimi', value: summary.planSelection?.currency },
      ],
    },
    {
      key: 'operations-info',
      title: 'Operasyon bilgileri',
      editStep: result.editSteps.operations,
      missingKeys: ['operations-info'],
      rows: [
        {
          label: 'Operasyon bilgileri',
          value: summary.legacyRequirements.operationsComplete ? 'Tamamlandı' : null,
        },
      ],
    },
    {
      key: 'documents',
      title: 'Zorunlu belgeler',
      editStep: result.editSteps.documents,
      returnToReview: true,
      missingKeys: ['documents'],
      rows: [
        {
          label: 'Güncel zorunlu dosyalar',
          value: summary.legacyRequirements.documentsComplete
            ? `${summary.legacyRequirements.requiredDocuments.length} belge yüklendi`
            : null,
        },
      ],
    },
  ];
}

export function ReviewStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: ReviewStepProps) {
  const navigateRef = useRef(onNavigate);
  const requestSequenceRef = useRef(0);
  const [review, setReview] = useState<TenantOnboardingReviewResult | null>(null);
  const [loadingReview, setLoadingReview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingConsents, setSavingConsents] = useState(false);
  const [selectedConsentKeys, setSelectedConsentKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const runOnce = useOnboardingActionGuard();
  const copy = useMemo(() => getReviewCopy(resolvedSession?.countryPack), [resolvedSession?.countryPack]);
  const blocks = useMemo(() => (review ? buildBlocks(review) : []), [review]);
  const missingLabels = useMemo(
    () => review?.missingRequiredBlocks.map((key) => MISSING_LABELS[key] ?? key) ?? [],
    [review?.missingRequiredBlocks],
  );
  const status = workspace.steps.find((step) => step.stepKey === 'final_review')?.status ?? 'in_progress';

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  const loadReview = useCallback(
    async (options?: { silent?: boolean }) => {
      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;
      // Silent refetches (post-save) MUST NOT toggle the loading flag — the
      // outer section unmounts when `loadingReview` flips to true, which
      // resets scroll position to the top and flashes the page. We capture
      // the new payload in the background and React reconciles in place.
      if (!options?.silent) {
        setLoadingReview(true);
      }
      setError(null);

      await getTenantOnboardingReview(workspace.stateToken)
        .then((result) => {
          if (requestSequence !== requestSequenceRef.current) {
            return;
          }
          if (result.redirectStep) {
            navigateRef.current(getTenantOnboardingStepUrl(workspace.stateToken, result.redirectStep));
            return;
          }
          setReview(result);
          setSelectedConsentKeys(
            result.summary?.compliance.acceptedConsents
              .filter((consent) => consent.accepted)
              .map((consent) => consent.consentKey) ?? [],
          );
        })
        .catch((caught: unknown) => {
          if (requestSequence === requestSequenceRef.current) {
            setError(caught instanceof Error ? caught.message : 'Başvuru özeti yüklenemedi.');
          }
        })
        .finally(() => {
          if (!options?.silent && requestSequence === requestSequenceRef.current) {
            setLoadingReview(false);
          }
        });
    },
    [workspace.stateToken],
  );

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  function editStep(step?: TenantOnboardingSessionStepKey, returnToReview?: boolean) {
    if (step) {
      const url = getTenantOnboardingStepUrl(workspace.stateToken, step);
      onNavigate(returnToReview ? `${url}?returnTo=review` : url);
    }
  }

  async function submitApplication() {
    await runOnce(async () => {
      let navigating = false;
      setSubmitting(true);
      setError(null);
      try {
        const result = await submitTenantOnboardingByStateToken(workspace.stateToken);
        onWorkspaceResolved(result.workspace);
        navigating = true;
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, 'submitted'));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Başvuru gönderilemedi.');
      } finally {
        if (!navigating) {
          setSubmitting(false);
        }
      }
    });
  }

  function toggleConsent(consentKey: string, checked: boolean) {
    setSelectedConsentKeys((current) => (
      checked
        ? Array.from(new Set([...current, consentKey]))
        : current.filter((key) => key !== consentKey)
    ));
  }

  async function saveConsents() {
    await runOnce(async () => {
      // Capture the scroll position before the save so any layout shift
      // from removing the "Onayları kaydet" action button does NOT bounce
      // the user back to the top of the page.
      const previousScroll = typeof window !== 'undefined' ? window.scrollY : 0;
      setSavingConsents(true);
      setError(null);
      try {
        await saveTenantOnboardingConsents(workspace.stateToken, selectedConsentKeys);
        // Silent refetch: do not flip the page back to the "yükleniyor"
        // placeholder. After the data resolves, restore scroll so the user
        // stays anchored on the consent card.
        await loadReview({ silent: true });
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: previousScroll, left: 0, behavior: 'auto' });
          });
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Onaylar kaydedilemedi.');
      } finally {
        setSavingConsents(false);
      }
    });
  }

  const consentDefinitions = review?.summary?.compliance.acceptedConsents ?? [];
  const requiredConsentKeys = consentDefinitions
    .filter((consent) => consent.required)
    .map((consent) => consent.consentKey);
  const allRequiredConsentsSelected = requiredConsentKeys.every((key) => selectedConsentKeys.includes(key));

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={7}
        totalSteps={0}
        status={status}
        updatedAt={workspace.application.updatedAt}
        title={copy.title}
        description={copy.helperText}
      />

      <div className="grid gap-5">
        <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[13px] leading-6 text-primary-700">
          {copy.countryNote}
        </div>

        {error ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        {loadingReview ? (
          <div className="flex min-h-40 items-center justify-center rounded-[8px] border border-ink-100 text-[14px] text-ink-500">
            Başvuru özeti yükleniyor...
          </div>
        ) : (
          <>
            {missingLabels.length > 0 ? (
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-4 text-[13px] leading-6 text-amber-800">
                <p className="font-semibold">{copy.missingText}</p>
                <p className="mt-1">{missingLabels.join(', ')}</p>
                {review?.missingRequiredBlocks.includes('operations-info') ? (
                  <p className="mt-2">
                    Başvuruyu göndermeden önce operasyon bilgilerini ekleyin.
                  </p>
                ) : null}
              </div>
            ) : null}

            <section className="rounded-[8px] border border-ink-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold text-ink-900">Onaylar ve izinler</h3>
                  <p className="mt-1 text-[12px] leading-5 text-ink-500">
                    Bu metinler başvuru temeli için taslaktır. Ülkeye özgü incelenmiş hukuki metinler yayına alınmadan önce yerini alacaktır.
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  review?.missingRequiredBlocks.includes('consents')
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-success-50 text-success-700'
                }`}>
                  {review?.missingRequiredBlocks.includes('consents') ? 'Eksik' : 'Tamamlandı'}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {consentDefinitions.map((consent) => {
                  const stored = consent.accepted;
                  const checked = stored || selectedConsentKeys.includes(consent.consentKey);
                  const previewBody = consent.documentBody?.trim() ?? '';
                  const previewTitle = consent.documentTitle?.trim() || consent.label;
                  return (
                    <div
                      key={consent.consentKey}
                      className="rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-3"
                    >
                      <label className="flex cursor-pointer gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={stored || savingConsents || submitting}
                          onChange={(event) => toggleConsent(consent.consentKey, event.target.checked)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-ink-800">
                            {consent.label}
                          </span>
                          <span className="mt-1 block text-[12px] leading-5 text-ink-500">
                            {consent.description}
                          </span>
                          <span className="mt-2 block text-[11px] leading-5 text-ink-500">
                            Belge: {consent.documentCode} · Sürüm: {consent.documentVersion}
                          </span>
                          {consent.reacceptanceRequired ? (
                            <span className="mt-2 block rounded-[8px] bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
                              Daha önceki {consent.previouslyAcceptedVersion} sürümü kabul edilmiş.
                              Güncel sürüm için yeniden onay gereklidir.
                            </span>
                          ) : null}
                          {stored ? (
                            <span className="mt-2 inline-flex rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                              Kabul edildi ve kaydedildi
                            </span>
                          ) : null}
                        </span>
                      </label>

                      {previewBody || consent.documentUrl ? (
                        <details className="mt-3 rounded-[8px] border border-ink-100 bg-white">
                          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-semibold text-primary-700 hover:underline">
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden>▸</span> Belgeyi inceleyin
                            </span>
                          </summary>
                          <div className="border-t border-ink-100 px-3 py-3">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                              {previewTitle}
                            </p>
                            {previewBody ? (
                              <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-[1.65] text-ink-700">
                                {previewBody}
                              </p>
                            ) : (
                              <p className="mt-2 text-[12px] text-ink-500">
                                Yerel inceleme metni bu sürüm için henüz yapılandırılmadı.
                              </p>
                            )}
                            {consent.documentUrl ? (
                              <a
                                href={consent.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="mt-3 inline-flex text-[12px] font-semibold text-primary hover:underline"
                              >
                                Tam metni görüntüle ↗
                              </a>
                            ) : null}
                          </div>
                        </details>
                      ) : (
                        <p className="mt-3 text-[11px] text-ink-500">
                          Bu sürüm için henüz inceleme metni veya bağlantı tanımlanmadı.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {review?.missingRequiredBlocks.includes('consents') ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void saveConsents()}
                    disabled={!allRequiredConsentsSelected || savingConsents || submitting}
                    className="rounded-[8px] bg-primary px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    {savingConsents ? 'Kaydediliyor...' : 'Onayları kaydet'}
                  </Button>
                </div>
              ) : null}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              {blocks.map((block) => {
                const incomplete = block.missingKeys.some((key) => review?.missingRequiredBlocks.includes(key));
                return (
                  <section key={block.key} className="rounded-[8px] border border-ink-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[15px] font-bold text-ink-900">{block.title}</h3>
                        <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          incomplete ? 'bg-amber-50 text-amber-700' : 'bg-success-50 text-success-700'
                        }`}>
                          {incomplete ? 'Eksik' : 'Tamamlandı'}
                        </span>
                      </div>
                      {block.editStep ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => editStep(block.editStep, block.returnToReview)}
                          disabled={submitting}
                          className="rounded-[8px] px-3 py-2 text-[12px] font-semibold"
                        >
                          Düzenle
                        </Button>
                      ) : null}
                    </div>
                    <dl className="mt-4 grid gap-3">
                      {block.rows.map((row) => (
                        <div key={row.label} className="grid grid-cols-[minmax(96px,0.42fr)_1fr] gap-3 text-[12px] leading-5">
                          <dt className="text-ink-500">{row.label}</dt>
                          <dd className={valueOrMissing(row.value) === 'Eksik' ? 'text-amber-700' : 'text-ink-800'}>
                            {valueOrMissing(row.value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>

      <OnboardingBottomActionBar
        primaryLabel={copy.submitLabel}
        onPrimary={() => void submitApplication()}
        primaryDisabled={
          submitting ||
          savingConsents ||
          loadingReview ||
          !review?.canSubmitForReview ||
          Boolean(resolvedSession?.redirectStep)
        }
        primaryLoading={submitting}
      />
    </Card>
  );
}
