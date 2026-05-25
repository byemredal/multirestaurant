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
  'phone-verification': 'Contact verification',
  location: 'Location',
  address: 'Business address',
  'business-details': 'Business details',
  'authorized-person': 'Authorized person',
  'bank-details': 'Bank details',
  'billing-address': 'Billing address',
  'plan-selection': 'Plan selection',
  'operations-info': 'Legacy operations information',
  documents: 'Required documents',
  consents: 'Required acknowledgements',
};

function valueOrMissing(value: unknown) {
  const display = value === null || value === undefined ? '' : String(value).trim();
  return display || 'Missing';
}

function buildBlocks(result: TenantOnboardingReviewResult): ReviewBlock[] {
  const summary = result.summary;
  if (!summary) {
    return [];
  }

  return [
    {
      key: 'phone-verification',
      title: 'Contact / phone verification',
      editStep: result.editSteps.phone,
      missingKeys: ['phone-verification'],
      rows: [
        { label: 'Phone', value: summary.phoneVerification.maskedPhoneNumber },
        { label: 'Verification', value: summary.phoneVerification.verified ? 'Verified' : null },
      ],
    },
    {
      key: 'location',
      title: 'Location selection',
      editStep: result.editSteps.location,
      missingKeys: ['location'],
      rows: [
        { label: 'Selected location', value: summary.locationSelection?.locationLabel },
        { label: 'Country', value: summary.locationSelection?.country },
      ],
    },
    {
      key: 'address',
      title: 'Business address',
      editStep: result.editSteps.address,
      missingKeys: ['address'],
      rows: [
        { label: 'Business name', value: summary.businessInfo?.businessName },
        { label: 'Address', value: summary.businessInfo?.addressLine1 },
        {
          label: 'City / postal code',
          value: [summary.businessInfo?.postalCode, summary.businessInfo?.city].filter(Boolean).join(' '),
        },
        { label: 'Country', value: summary.businessInfo?.country },
      ],
    },
    {
      key: 'business-details',
      title: 'Commercial / legal / tax details',
      editStep: result.editSteps.businessDetails,
      missingKeys: ['business-details'],
      rows: [
        { label: 'Registered name', value: summary.legalTaxInfo?.legalEntityName },
        { label: 'Tax reference', value: summary.legalTaxInfo?.taxId },
        { label: 'VAT reference', value: summary.legalTaxInfo?.vatId },
        { label: 'Registration country', value: summary.legalTaxInfo?.registrationCountry },
      ],
    },
    {
      key: 'authorized-person',
      title: 'Authorized person',
      editStep: result.editSteps.authorizedPerson,
      missingKeys: ['authorized-person'],
      rows: [
        { label: 'Name', value: summary.ownerContactInfo?.fullName },
        { label: 'Email', value: summary.ownerContactInfo?.email },
        { label: 'Phone', value: summary.ownerContactInfo?.phoneNumber },
        { label: 'Role', value: summary.ownerContactInfo?.roleTitle },
      ],
    },
    {
      key: 'bank-details',
      title: 'Bank details',
      editStep: result.editSteps.bankDetails,
      missingKeys: ['bank-details'],
      rows: [
        { label: 'Bank', value: summary.bankDetails?.bankName },
        { label: 'Account holder', value: summary.bankDetails?.accountHolderName },
        { label: 'IBAN', value: summary.bankDetails?.maskedIban },
        { label: 'Currency', value: summary.bankDetails?.currency },
      ],
    },
    {
      key: 'billing-address',
      title: 'Billing address',
      editStep: result.editSteps.billingAddress,
      missingKeys: ['billing-address'],
      rows: [
        { label: 'Billing name', value: summary.billingAddress?.billingName },
        { label: 'Address', value: summary.billingAddress?.addressLine1 },
        {
          label: 'City / postal code',
          value: [summary.billingAddress?.postalCode, summary.billingAddress?.city].filter(Boolean).join(' '),
        },
        { label: 'Country', value: summary.billingAddress?.country },
      ],
    },
    {
      key: 'plan-selection',
      title: 'Selected plan',
      editStep: result.editSteps.planSelection,
      missingKeys: ['plan-selection'],
      rows: [
        { label: 'Plan', value: summary.planSelection?.planNameSnapshot },
        { label: 'Fee summary', value: summary.planSelection?.commissionSummarySnapshot },
        { label: 'Currency', value: summary.planSelection?.currency },
      ],
    },
    {
      key: 'operations-info',
      title: 'Operational setup',
      editStep: result.editSteps.operations,
      missingKeys: ['operations-info'],
      rows: [
        {
          label: 'Operations information',
          value: summary.legacyRequirements.operationsComplete ? 'Complete' : null,
        },
      ],
    },
    {
      key: 'documents',
      title: 'Required documents',
      editStep: result.editSteps.documents,
      returnToReview: true,
      missingKeys: ['documents'],
      rows: [
        {
          label: 'Current required files',
          value: summary.legacyRequirements.documentsComplete
            ? `${summary.legacyRequirements.requiredDocuments.length} uploaded`
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

  const loadReview = useCallback(async () => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoadingReview(true);
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
          setError(caught instanceof Error ? caught.message : 'Review summary could not be loaded.');
        }
      })
      .finally(() => {
        if (requestSequence === requestSequenceRef.current) {
          setLoadingReview(false);
        }
      });
  }, [workspace.stateToken]);

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
      setSubmitting(true);
      setError(null);
      try {
        const result = await submitTenantOnboardingByStateToken(workspace.stateToken);
        onWorkspaceResolved(result.workspace);
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, 'submitted'));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Application could not be submitted.');
      } finally {
        setSubmitting(false);
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
      setSavingConsents(true);
      setError(null);
      try {
        await saveTenantOnboardingConsents(workspace.stateToken, selectedConsentKeys);
        await loadReview();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Acknowledgements could not be saved.');
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
            Loading application summary...
          </div>
        ) : (
          <>
            {missingLabels.length > 0 ? (
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-4 text-[13px] leading-6 text-amber-800">
                <p className="font-semibold">{copy.missingText}</p>
                <p className="mt-1">{missingLabels.join(', ')}</p>
                {review?.missingRequiredBlocks.includes('operations-info') ? (
                  <p className="mt-2">
                    Add operational setup information before submission.
                  </p>
                ) : null}
              </div>
            ) : null}

            <section className="rounded-[8px] border border-ink-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold text-ink-900">Acknowledgements and consent</h3>
                  <p className="mt-1 text-[12px] leading-5 text-ink-500">
                    Placeholder wording for onboarding foundation only. Reviewed country-specific legal text will replace it before production use.
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  review?.missingRequiredBlocks.includes('consents')
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-success-50 text-success-700'
                }`}>
                  {review?.missingRequiredBlocks.includes('consents') ? 'Missing' : 'Complete'}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {consentDefinitions.map((consent) => {
                  const stored = consent.accepted;
                  const checked = stored || selectedConsentKeys.includes(consent.consentKey);
                  return (
                    <label key={consent.consentKey} className="flex gap-3 rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={stored || savingConsents || submitting}
                        onChange={(event) => toggleConsent(consent.consentKey, event.target.checked)}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-ink-800">{consent.label}</span>
                        <span className="mt-1 block text-[12px] leading-5 text-ink-500">{consent.description}</span>
                        {stored ? (
                          <span className="mt-2 inline-flex rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                            Accepted and saved
                          </span>
                        ) : null}
                      </span>
                    </label>
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
                    {savingConsents ? 'Saving...' : 'Save acknowledgements'}
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
                          {incomplete ? 'Missing' : 'Complete'}
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
                          Edit
                        </Button>
                      ) : null}
                    </div>
                    <dl className="mt-4 grid gap-3">
                      {block.rows.map((row) => (
                        <div key={row.label} className="grid grid-cols-[minmax(96px,0.42fr)_1fr] gap-3 text-[12px] leading-5">
                          <dt className="text-ink-500">{row.label}</dt>
                          <dd className={valueOrMissing(row.value) === 'Missing' ? 'text-amber-700' : 'text-ink-800'}>
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
