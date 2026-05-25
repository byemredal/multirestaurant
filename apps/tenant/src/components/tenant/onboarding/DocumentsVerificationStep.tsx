'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, FileDropzone, Input } from '@lieferzonen/ui';
import {
  getTenantOnboardingConsents,
  uploadTenantOnboardingDocumentByStateToken,
  type TenantOnboardingComplianceResult,
  type TenantOnboardingDocument,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getDocumentsVerificationCopy } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type DocumentsVerificationStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

const DOCUMENT_STATUS_COPY: Record<TenantOnboardingDocument['status'], { label: string; className: string }> = {
  pending: { label: 'Uploaded / pending review', className: 'bg-primary-50 text-primary-700' },
  approved: { label: 'Approved', className: 'bg-success-50 text-success-700' },
  rejected: { label: 'Rejected', className: 'bg-danger-50 text-danger-700' },
  revision_requested: { label: 'Needs replacement', className: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expired', className: 'bg-amber-50 text-amber-700' },
};

function currentDocuments(workspace: TenantOnboardingWorkspace) {
  return (
    (workspace.steps.find((step) => step.stepKey === 'documents')?.data as TenantOnboardingDocument[] | undefined) ?? []
  ).filter((document) => document.isCurrent);
}

function requiredDocumentsSatisfied(documents: TenantOnboardingDocument[]) {
  return documents.some(
    (document) =>
      document.isRequired &&
      !['rejected', 'revision_requested', 'expired'].includes(document.status),
  );
}

export function DocumentsVerificationStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: DocumentsVerificationStepProps) {
  const searchParams = useSearchParams();
  const returnToReview = searchParams.get('returnTo') === 'review';
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState('');
  const [uploading, setUploading] = useState(false);
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
  const documentsSatisfied = useMemo(() => requiredDocumentsSatisfied(documents), [documents]);
  const status = workspace.steps.find((step) => step.stepKey === 'documents')?.status ?? 'in_progress';
  const documentDefinitions = requirements?.documentRequirements?.definitions ?? [];

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
        const firstType = result.documentRequirements?.definitions[0]?.type;
        if (firstType) {
          setDocumentType((current) => current || firstType);
        }
      })
      .catch((caught: unknown) => {
        if (requestSequence === requestSequenceRef.current) {
          setError(caught instanceof Error ? caught.message : 'Document requirements could not be loaded.');
        }
      })
      .finally(() => {
        if (requestSequence === requestSequenceRef.current) {
          setLoadingRequirements(false);
        }
      });
  }, [workspace.stateToken]);

  async function uploadDocument() {
    if (!file) {
      setError('Choose a PDF or image document before uploading.');
      return;
    }

    await runOnce(async () => {
      let navigating = false;
      setUploading(true);
      setError(null);
      try {
        const result = await uploadTenantOnboardingDocumentByStateToken(workspace.stateToken, file, {
          type: documentType,
          isRequired: true,
          expiresAt: expiresAt || undefined,
        });
        onWorkspaceResolved(result.workspace);
        setFile(null);
        if (returnToReview) {
          navigating = true;
          onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, 'review'));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Document could not be uploaded.');
      } finally {
        if (!navigating) {
          setUploading(false);
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
        <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[13px] leading-6 text-primary-700">
          {copy.countryNote}
        </div>

        <section className="rounded-[8px] border border-ink-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-ink-900">Required documents</h3>
              <p className="mt-1 text-[13px] text-ink-500">
                {requirements?.documentRequirements?.validationPolicy.note ?? copy.requirement}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              documentsSatisfied ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {documentsSatisfied ? 'Complete' : 'Missing'}
            </span>
          </div>
          <p className="mt-3 rounded-[8px] bg-ink-50 px-3 py-2 text-[12px] leading-5 text-ink-600">
            {copy.reviewNote}
          </p>
        </section>

        <section className="rounded-[8px] border border-ink-200 bg-white p-4">
          <h3 className="text-[15px] font-bold text-ink-900">Country-pack document guidance</h3>
          <p className="mt-2 text-[12px] leading-5 text-ink-500">
            These placeholder categories guide upload selection only. They are not yet enforced as a final country-specific document set.
          </p>
          {loadingRequirements ? (
            <p className="mt-4 text-[13px] text-ink-500">Loading document guidance...</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {documentDefinitions.map((definition) => {
                const uploaded = documents.some((document) => document.type === definition.type);
                return (
                  <div key={definition.type} className="rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-ink-800">{definition.label}</p>
                        <p className="mt-1 text-[12px] text-ink-500">{definition.description}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        uploaded ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-600'
                      }`}>
                        {uploaded ? 'Uploaded' : 'Guidance'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {error ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        <section className="rounded-[8px] border border-ink-200 bg-white p-4">
          <h3 className="text-[15px] font-bold text-ink-900">Upload a document</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-ink-700">Document category</span>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                disabled={uploading}
                className="h-11 w-full rounded-[8px] border border-ink-200 bg-white px-3 text-[14px] text-ink-800 outline-none focus:border-primary"
              >
                {documentDefinitions.map((option) => (
                  <option key={option.type} value={option.type}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-ink-700">Expiry date, if applicable</span>
              <Input
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                disabled={uploading}
              />
            </label>
          </div>
          <FileDropzone
            accept=".pdf,.jpg,.jpeg,.png"
            maxSizeMb={10}
            file={file}
            onFile={setFile}
            disabled={uploading}
            className="mt-4"
          />
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={() => void uploadDocument()}
              disabled={uploading || loadingRequirements || !documentType || !file || Boolean(resolvedSession?.redirectStep)}
              className="rounded-[8px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : 'Upload document'}
            </Button>
          </div>
        </section>

        <section className="rounded-[8px] border border-ink-200 bg-white p-4">
          <h3 className="text-[15px] font-bold text-ink-900">Current uploaded documents</h3>
          {documents.length === 0 ? (
            <p className="mt-4 rounded-[8px] border border-dashed border-ink-200 bg-ink-50 px-4 py-4 text-[13px] text-ink-500">
              No current document has been uploaded yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {documents.map((document) => {
                const statusCopy = DOCUMENT_STATUS_COPY[document.status];
                return (
                  <div key={document.id} className="rounded-[8px] border border-ink-100 bg-ink-50 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-ink-800">{document.type}</p>
                        <p className="mt-1 text-[12px] text-ink-500">
                          Version {document.version} - uploaded {new Date(document.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusCopy.className}`}>
                        {statusCopy.label}
                      </span>
                    </div>
                    {document.rejectionReason ? (
                      <p className="mt-3 rounded-[8px] bg-danger-50 px-3 py-2 text-[12px] text-danger-700">
                        {document.rejectionReason}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {documentsSatisfied && !returnToReview ? (
          <OnboardingBottomActionBar
            primaryLabel="Return to review"
            onPrimary={returnToReviewPage}
            primaryDisabled={uploading || returningToReview || Boolean(resolvedSession?.redirectStep)}
            primaryLoading={returningToReview}
          />
        ) : null}
      </div>
    </Card>
  );
}
