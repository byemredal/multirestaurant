import { BadRequestException } from '@nestjs/common';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { tenantOnboardingStepKeys, type TenantDocument } from './entities/tenant-onboarding.entity';

describe('TenantOnboardingService document requirement handling', () => {
  const countryPack = {
    countryCode: 'TR',
    locale: 'tr-TR',
    currencyCode: 'TRY',
  };

  function requirement(
    documentType: string,
    input?: Partial<{ required: boolean; guidanceOnly: boolean }>,
  ) {
    return {
      id: `req-${documentType}`,
      country: 'TR',
      language: 'tr-TR',
      documentType,
      label: documentType,
      description: `${documentType} description`,
      required: input?.required ?? true,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      guidanceOnly: input?.guidanceOnly ?? false,
      active: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function document(
    type: string,
    input?: Partial<TenantDocument>,
  ): TenantDocument {
    return {
      id: `doc-${type}`,
      applicationId: 'app-1',
      fileAssetId: `asset-${type}`,
      type,
      status: 'pending',
      isRequired: true,
      version: 1,
      isCurrent: true,
      uploadedAt: new Date(),
      reviewedAt: null,
      reviewedByAdminId: null,
      rejectionReason: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
  }

  function completedSteps(overrides?: Partial<Record<string, string>>) {
    return tenantOnboardingStepKeys.map((stepKey) => ({
      id: `step-${stepKey}`,
      applicationId: 'app-1',
      stepKey,
      status: overrides?.[stepKey] ?? 'completed',
      completedAt: new Date(),
      blockedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  function buildService(options?: {
    requirements?: any[];
    documents?: TenantDocument[];
    steps?: any[];
    latestVersions?: number[];
    consentSnapshots?: any[];
  }) {
    const store = {
      listActiveComplianceDocumentRequirements: jest.fn().mockResolvedValue(options?.requirements ?? []),
      listActiveComplianceConsentDefinitions: jest.fn().mockResolvedValue([]),
      listStepProgress: jest.fn().mockResolvedValue(options?.steps ?? completedSteps()),
      listDocuments: jest.fn().mockResolvedValue(options?.documents ?? []),
      listConsentSnapshots: jest.fn().mockResolvedValue(options?.consentSnapshots ?? [
        {
          consentKey: 'privacy_acknowledgement',
          documentVersion: 'placeholder-v1',
          accepted: true,
        },
        {
          consentKey: 'partner_terms_acknowledgement',
          documentVersion: 'placeholder-v1',
          accepted: true,
        },
      ]),
      markDocumentsNotCurrent: jest.fn().mockResolvedValue(undefined),
      getLatestDocumentVersion: jest.fn(),
      createDocument: jest.fn().mockImplementation(async (input) => ({
        id: `created-${input.type}-${input.version}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      })),
      upsertStepProgress: jest.fn().mockResolvedValue(undefined),
    };
    const versions = options?.latestVersions ?? [0, 0, 0];
    versions.forEach((version) => store.getLatestDocumentVersion.mockResolvedValueOnce(version));
    store.getLatestDocumentVersion.mockResolvedValue(0);

    const service = new TenantOnboardingService(
      store as any,
      {} as any,
      {
        registerTenantUpload: jest.fn().mockResolvedValue({
          id: 'asset-1',
        }),
      } as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      {
        findActiveCountryPolicy: jest.fn().mockResolvedValue(countryPack),
        findActive: jest.fn().mockResolvedValue({ pack: { legalDocuments: [] } }),
      } as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service as any, 'ensureEditableApplication').mockResolvedValue({
      id: 'app-1',
      tenantAccountId: 'tenant-1',
      status: 'draft',
    });

    return { service, store };
  }

  it('keeps different document types as separate current TenantDocument rows', async () => {
    const { service, store } = buildService({
      requirements: [requirement('tax_certificate'), requirement('identity_document')],
      latestVersions: [0, 0],
    });
    const file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 12, path: '/private/doc.pdf' };

    await service.uploadDocumentFromFile('tenant-1', file, { type: 'tax_certificate' });
    await service.uploadDocumentFromFile('tenant-1', file, { type: 'identity_document' });

    expect(store.markDocumentsNotCurrent).toHaveBeenNthCalledWith(1, 'app-1', 'tax_certificate');
    expect(store.markDocumentsNotCurrent).toHaveBeenNthCalledWith(2, 'app-1', 'identity_document');
    expect(store.createDocument.mock.calls[0][0]).toMatchObject({ type: 'tax_certificate', version: 1 });
    expect(store.createDocument.mock.calls[1][0]).toMatchObject({ type: 'identity_document', version: 1 });
  });

  it('versions only within the same document type when re-uploaded', async () => {
    const { service, store } = buildService({
      requirements: [requirement('tax_certificate')],
      latestVersions: [0, 1],
    });
    const file = { originalname: 'tax.pdf', mimetype: 'application/pdf', size: 12, path: '/private/tax.pdf' };

    await service.uploadDocumentFromFile('tenant-1', file, { type: 'tax_certificate' });
    await service.uploadDocumentFromFile('tenant-1', file, { type: 'tax_certificate' });

    expect(store.markDocumentsNotCurrent).toHaveBeenNthCalledWith(1, 'app-1', 'tax_certificate');
    expect(store.markDocumentsNotCurrent).toHaveBeenNthCalledWith(2, 'app-1', 'tax_certificate');
    expect(store.createDocument.mock.calls[0][0]).toMatchObject({ type: 'tax_certificate', version: 1 });
    expect(store.createDocument.mock.calls[1][0]).toMatchObject({ type: 'tax_certificate', version: 2 });
  });

  it('does not allow submission until every required document type has a current valid upload', async () => {
    const { service } = buildService({
      requirements: [requirement('tax_certificate'), requirement('identity_document')],
      documents: [document('tax_certificate')],
    });

    await expect((service as any).assertReadyForSubmission('app-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        missingDocumentTypes: ['identity_document'],
      }),
    });
  });

  it('binds revision-required blocking to the matching document type', async () => {
    const { service } = buildService({
      requirements: [requirement('tax_certificate'), requirement('identity_document')],
      documents: [
        document('tax_certificate', { status: 'revision_requested' }),
        document('identity_document'),
      ],
    });

    await expect((service as any).assertReadyForSubmission('app-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        missingDocumentTypes: ['tax_certificate'],
      }),
    });
  });

  it('does not block submission for optional or guidance-only document requirements', async () => {
    const { service } = buildService({
      requirements: [
        requirement('optional_bank_statement', { required: false }),
        requirement('guidance_tax_note', { required: true, guidanceOnly: true }),
      ],
      documents: [],
      steps: completedSteps({ documents: 'not_started' }),
    });

    await expect((service as any).assertReadyForSubmission('app-1')).resolves.toBeUndefined();
  });

  it('resolves when all required document types have current valid uploads', async () => {
    const { service } = buildService({
      requirements: [requirement('tax_certificate'), requirement('identity_document')],
      documents: [document('tax_certificate'), document('identity_document')],
    });

    await expect((service as any).assertReadyForSubmission('app-1')).resolves.toBeUndefined();
  });

  it('throws BadRequestException for an empty document type', async () => {
    const { service } = buildService();

    await expect(
      service.uploadDocumentFromFile(
        'tenant-1',
        { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 12, path: '/private/doc.pdf' },
        { type: '   ' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
