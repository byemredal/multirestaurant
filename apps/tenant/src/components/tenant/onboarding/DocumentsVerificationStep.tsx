'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card } from '@lieferzonen/ui';
import {
  getTenantOnboardingConsents,
  uploadTenantOnboardingDocumentByStateToken,
  type TenantOnboardingComplianceResult,
  type TenantOnboardingDocument,
  type TenantOnboardingDocumentRequirement,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getDocumentsVerificationCopy } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';
import {
  PartnerFileDropzone,
  PartnerInlineAlert,
  PartnerTextField,
} from './shared/PartnerFormPrimitives';

type DocumentsVerificationStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type UploadSlotState = {
  file: File | null;
  expiresAt: string;
  uploading: boolean;
  error: string | null;
};

const EMPTY_SLOT_STATE: UploadSlotState = {
  file: null,
  expiresAt: '',
  uploading: false,
  error: null,
};

const DOCUMENT_STATUS_COPY: Record<TenantOnboardingDocument['status'], { label: string; className: string }> = {
  pending: { label: 'Yuklendi / inceleme bekliyor', className: 'bg-primary-50 text-primary-700' },
  approved: { label: 'Onaylandi', className: 'bg-success-50 text-success-700' },
  rejected: { label: 'Reddedildi', className: 'bg-danger-50 text-danger-700' },
  revision_requested: { label: 'Yeniden yuklenmeli', className: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Suresi doldu', className: 'bg-amber-50 text-amber-700' },
};

const BLOCKING_DOCUMENT_STATUSES: ReadonlySet<TenantOnboardingDocument['status']> = new Set<TenantOnboardingDocument['status']>([
  'rejected',
  'revision_requested',
  'expired',
]);

function currentDocuments(workspace: TenantOnboardingWorkspace) {
  return (
    (workspace.steps.find((step) => step.stepKey === 'documents')?.data as TenantOnboardingDocument[] | undefined) ?? []
  ).filter((document) => document.isCurrent);
}

function isBlockingRequirement(definition: TenantOnboardingDocumentRequirement) {
  return definition.required && !definition.guidanceOnly;
}

function documentIsUsable(document: TenantOnboardingDocument | undefined) {
  return Boolean(document && !BLOCKING_DOCUMENT_STATUSES.has(document.status));
}

function findDocumentForType(documents: TenantOnboardingDocument[], type: string) {
  return documents.find((document) => document.type === type);
}

function requiredDocumentsSatisfied(
  documents: TenantOnboardingDocument[],
  definitions: TenantOnboardingDocumentRequirement[],
) {
  const requiredDefinitions = definitions.filter(isBlockingRequirement);
  if (requiredDefinitions.length === 0) {
    return true;
  }

  return requiredDefinitions.every((definition) =>
    documentIsUsable(findDocumentForType(documents, definition.type)),
  );
}

function acceptedFormatsFor(definition: TenantOnboardingDocumentRequirement) {
  const formats = definition.acceptedFormats.length > 0
    ? definition.acceptedFormats
    : ['pdf', 'jpg', 'jpeg', 'png'];
  return formats.map((format) => `.${format.replace(/^\./, '').toLowerCase()}`).join(',');
}

function slotKeyFor(definition: TenantOnboardingDocumentRequirement) {
  return definition.type;
}

export function DocumentsVerificationStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: DocumentsVerificationStepProps) {
  const searchParams = useSearchParams();
  const returnToReview = searchParams.get('returnTo') === 'review';
  const [uploadSlots, setUploadSlots] = useState<Record<string, UploadSlotState>>({});
  const [returningToReview, setReturningToReview] = useState(false);
  const [loadingRequirements, setLoadingRequirements] = useState(true);
  const [requirements, setRequirements] = useState<TenantOnboardingComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const runOnce = useOnboardingActionGuard();
  const copy = useMemo(
    () => getDocumentsVerificationCopy(resolvedSession?.countryPack),
    [resolvedSession?.countryPack],
  );
  const documents = useMemo(() => currentDocuments(workspace), [workspace]);
  const status = workspace.steps.find((step) => step.stepKey === 'documents')?.status ?? 'in_progress';
  const documentDefinitions = requirements?.documentRequirements?.definitions ?? [];
  const documentsSatisfied = useMemo(
    () => requiredDocumentsSatisfied(documents, documentDefinitions),
    [documents, documentDefinitions],
  );
  const hasAnyUploadingSlot = Object.values(uploadSlots).some((slot) => slot.uploading);

  useEffect(() => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoadingRequirements(true);
    setError(null);

    void getTenantOnboardingConsents(workspace.stateToken)
      .then((result) => {
        if (requestSequence !== requestSequenceRef.current) {
          return;
        }
        setRequirements(result);
      })
      .catch((caught: unknown) => {
        if (requestSequence === requestSequenceRef.current) {
          setError(caught instanceof Error ? caught.message : 'Belge gereksinimleri yuklenemedi.');
        }
      })
      .finally(() => {
        if (requestSequence === requestSequenceRef.current) {
          setLoadingRequirements(false);
        }
      });
  }, [workspace.stateToken]);

  function updateSlot(type: string, input: Partial<UploadSlotState>) {
    setUploadSlots((current) => ({
      ...current,
      [type]: {
        ...(current[type] ?? EMPTY_SLOT_STATE),
        ...input,
      },
    }));
  }

  async function uploadDocument(definition: TenantOnboardingDocumentRequirement) {
    const type = slotKeyFor(definition);
    const slot = uploadSlots[type] ?? EMPTY_SLOT_STATE;
    if (!slot.file) {
      updateSlot(type, { error: 'Yuklemeden once bir PDF veya gorsel belge secin.' });
      return;
    }

    await runOnce(async () => {
      let navigating = false;
      updateSlot(type, { uploading: true, error: null });
      setError(null);
      try {
        const result = await uploadTenantOnboardingDocumentByStateToken(workspace.stateToken, slot.file, {
          type: definition.type,
          isRequired: isBlockingRequirement(definition),
          expiresAt: slot.expiresAt || undefined,
        });
        onWorkspaceResolved(result.workspace);
        updateSlot(type, { file: null, uploading: false, error: null });
        if (returnToReview) {
          navigating = true;
          onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, 'review'));
        }
      } catch (caught) {
        updateSlot(type, {
          uploading: false,
          error: caught instanceof Error ? caught.message : 'Belge yuklenemedi.',
        });
      } finally {
        if (navigating) {
          updateSlot(type, { uploading: true });
        }
      }
    });
  }

  function returnToReviewPage() {
    setReturningToReview(true);
    onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, 'review'));
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={9}
        totalSteps={0}
        status={status}
        updatedAt={workspace.application.updatedAt}
        title={copy.title}
        description={copy.helperText}
      />

      <div className="grid gap-5">
        <PartnerInlineAlert tone="info">{copy.countryNote}</PartnerInlineAlert>

        <section className="rounded-[8px] border border-ink-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-ink-900">Zorunlu belgeler</h3>
              <p className="mt-1 text-[13px] text-ink-500">
                {requirements?.documentRequirements?.validationPolicy.note ?? copy.requirement}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              documentsSatisfied ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {documentsSatisfied ? 'Tamamlandi' : 'Eksik'}
            </span>
          </div>
          <p className="mt-3 rounded-[8px] bg-ink-50 px-3 py-2 text-[12px] leading-5 text-ink-600">
            {copy.reviewNote}
          </p>
        </section>

        {error ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        <section className="rounded-[8px] border border-ink-200 bg-white p-4">
          <h3 className="text-[15px] font-bold text-ink-900">Belge yukleyin</h3>
          {loadingRequirements ? (
            <p className="mt-4 text-[13px] text-ink-500">Belge gereksinimleri yukleniyor...</p>
          ) : documentDefinitions.length === 0 ? (
            <p className="mt-4 rounded-[8px] border border-dashed border-ink-200 bg-ink-50 px-4 py-4 text-[13px] text-ink-500">
              Bu ulke paketi icin belge gereksinimi bulunmuyor.
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              {documentDefinitions.map((definition, index) => {
                const type = slotKeyFor(definition);
                const slot = uploadSlots[type] ?? EMPTY_SLOT_STATE;
                const uploaded = findDocumentForType(documents, definition.type);
                const statusCopy = uploaded ? DOCUMENT_STATUS_COPY[uploaded.status] : null;
                const required = isBlockingRequirement(definition);

                return (
                  <div key={`${type}:${index}`} className="rounded-[8px] border border-ink-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-ink-900">{definition.label}</p>
                        <p className="mt-1 text-[12px] leading-5 text-ink-500">{definition.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          required ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-600'
                        }`}>
                          {required ? 'Zorunlu' : 'Opsiyonel'}
                        </span>
                        {statusCopy ? (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusCopy.className}`}>
                            {statusCopy.label}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {uploaded ? (
                      <div className="mt-3 rounded-[8px] bg-ink-50 px-3 py-2 text-[12px] leading-5 text-ink-600">
                        <span className="font-semibold text-ink-800">Guncel belge:</span>{' '}
                        {uploaded.type} - surum {uploaded.version} - {new Date(uploaded.uploadedAt).toLocaleString('tr-TR')}
                        {uploaded.rejectionReason ? (
                          <p className="mt-2 rounded-[8px] bg-danger-50 px-3 py-2 text-danger-700">
                            {uploaded.rejectionReason}
                          </p>
                        ) : null}
                      </div>
                    ) : required ? (
                      <p className="mt-3 rounded-[8px] bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                        Bu belge tipi yuklenmeden basvuru gonderilemez.
                      </p>
                    ) : null}

                    {slot.error ? (
                      <div className="mt-3 rounded-[8px] border border-danger-200 bg-danger-50 px-3 py-2 text-[12px] text-danger-600">
                        {slot.error}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                      <PartnerFileDropzone
                        accept={acceptedFormatsFor(definition)}
                        maxSizeMb={10}
                        file={slot.file}
                        onFile={(file) => updateSlot(type, { file, error: null })}
                        onClear={() => updateSlot(type, { file: null })}
                        disabled={slot.uploading || Boolean(resolvedSession?.redirectStep)}
                        uploading={slot.uploading}
                      />
                      <div className="grid content-start gap-3">
                        <label className="block">
                          <span className="mb-2 block text-[13px] font-semibold text-ink-700">Varsa gecerlilik bitis tarihi</span>
                          <PartnerTextField
                            type="date"
                            value={slot.expiresAt}
                            onChange={(event) => updateSlot(type, { expiresAt: event.target.value })}
                            disabled={slot.uploading || Boolean(resolvedSession?.redirectStep)}
                          />
                        </label>
                        <Button
                          type="button"
                          onClick={() => void uploadDocument(definition)}
                          disabled={slot.uploading || loadingRequirements || !slot.file || Boolean(resolvedSession?.redirectStep)}
                          className="rounded-[8px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
                        >
                          {slot.uploading ? 'Yukleniyor...' : uploaded ? 'Belgeyi degistir' : 'Belgeyi yukle'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {documentsSatisfied && !returnToReview ? (
          <OnboardingBottomActionBar
            primaryLabel="Kontrole don"
            onPrimary={returnToReviewPage}
            primaryDisabled={hasAnyUploadingSlot || returningToReview || Boolean(resolvedSession?.redirectStep)}
            primaryLoading={returningToReview}
          />
        ) : null}
      </div>
    </Card>
  );
}
