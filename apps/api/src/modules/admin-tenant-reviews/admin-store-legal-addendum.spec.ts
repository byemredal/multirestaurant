import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminTenantReviewsService } from './admin-tenant-reviews.service';

/**
 * MR-DB-HARDENING-01 Slice 7D — admin store legal document read/write now flows
 * through canonical StoreTermsAddendum (parent = current PlatformLegalDocumentVersion),
 * never the legacy StoreLegalDocument(+Translation) tables. Legacy read remains
 * a fallback only when no canonical addendum exists.
 */
describe('AdminTenantReviewsService store legal documents (Slice 7D)', () => {
  const tenantId = 'tenant-1';
  const storeId = 'store-1';

  function build(overrides: {
    owned?: boolean;
    parentVersionId?: string | null;
    addendumsWithType?: any[];
  } = {}) {
    const storesService = {
      findOwnedStore: jest
        .fn()
        .mockResolvedValue(overrides.owned === false ? null : { id: storeId }),
    };
    const legalConsentService = {
      resolveCurrentParentVersionId: jest
        .fn()
        .mockResolvedValue(
          overrides.parentVersionId === undefined
            ? 'ver-1'
            : overrides.parentVersionId,
        ),
      upsertStoreAddendumForParent: jest.fn().mockImplementation((_s, input) =>
        Promise.resolve({
          id: `add-${input.locale}`,
          storeId,
          parentDocumentVersionId: input.parentDocumentVersionId,
          title: input.title,
          body: input.body,
          locale: input.locale,
          isActive: input.isActive,
          createdAt: new Date('2026-05-10T00:00:00.000Z'),
          updatedAt: new Date('2026-05-10T00:00:00.000Z'),
        }),
      ),
      listStoreAddendumsWithTypeCode: jest
        .fn()
        .mockResolvedValue(overrides.addendumsWithType ?? []),
    };
    const storeSettingsService = {
      upsertStoreLegalDocument: jest.fn(),
    };
    const auditLogService = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new AdminTenantReviewsService(
      {} as any,
      {} as any,
      auditLogService as any,
      {} as any,
      storesService as any,
      {} as any,
      storeSettingsService as any,
      {} as any,
      legalConsentService as any,
    );
    return { service, storesService, legalConsentService, storeSettingsService };
  }

  const dto = {
    versionLabel: 'v1',
    isPublished: true,
    translations: [{ locale: 'tr', title: 'Şartlar', body: 'Metin' }],
  } as any;

  it('writes to StoreTermsAddendum and never to the legacy StoreLegalDocument path', async () => {
    const { service, legalConsentService, storeSettingsService } = build();

    const result = await service.updateTenantStoreLegalDocument(
      tenantId,
      storeId,
      'terms_and_conditions',
      'admin-1',
      dto,
    );

    expect(legalConsentService.resolveCurrentParentVersionId).toHaveBeenCalledWith(
      'terms_of_service',
      'tr',
    );
    expect(legalConsentService.upsertStoreAddendumForParent).toHaveBeenCalledWith(
      storeId,
      expect.objectContaining({
        parentDocumentVersionId: 'ver-1',
        locale: 'tr',
        title: 'Şartlar',
        isActive: true,
      }),
    );
    expect(storeSettingsService.upsertStoreLegalDocument).not.toHaveBeenCalled();
    // Backward-compatible response shape.
    expect(result).toEqual(
      expect.objectContaining({
        storeId,
        documentType: 'terms_and_conditions',
        isPublished: true,
        translations: [expect.objectContaining({ locale: 'tr', title: 'Şartlar' })],
      }),
    );
  });

  it('fails with store_legal_parent_document_missing when no current parent version exists', async () => {
    const { service, legalConsentService } = build({ parentVersionId: null });

    await expect(
      service.updateTenantStoreLegalDocument(
        tenantId,
        storeId,
        'distance_sales',
        'admin-1',
        dto,
      ),
    ).rejects.toMatchObject({ response: { code: 'store_legal_parent_document_missing' } });

    expect(legalConsentService.upsertStoreAddendumForParent).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant store with NotFound and writes nothing', async () => {
    const { service, legalConsentService } = build({ owned: false });

    await expect(
      service.updateTenantStoreLegalDocument(
        tenantId,
        storeId,
        'privacy_notice',
        'admin-1',
        dto,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(legalConsentService.resolveCurrentParentVersionId).not.toHaveBeenCalled();
    expect(legalConsentService.upsertStoreAddendumForParent).not.toHaveBeenCalled();
  });

  it('read view derives legalDocuments from canonical addendums (grouped by type)', async () => {
    const { service } = build({
      addendumsWithType: [
        {
          id: 'add-tr',
          storeId,
          parentDocumentVersionId: 'ver-1',
          title: 'Şartlar',
          body: 'Metin',
          locale: 'tr',
          isActive: true,
          typeCode: 'terms_of_service',
          createdAt: new Date('2026-05-10T00:00:00.000Z'),
          updatedAt: new Date('2026-05-10T00:00:00.000Z'),
        },
      ],
    });

    const view = await (service as any).buildStoreLegalDocumentsView(storeId, [
      { id: 'legacy', documentType: 'privacy_notice', translations: [] },
    ]);

    expect(view).toHaveLength(1);
    expect(view[0]).toEqual(
      expect.objectContaining({
        documentType: 'terms_and_conditions',
        isPublished: true,
      }),
    );
    expect(view[0].translations[0]).toEqual(
      expect.objectContaining({ locale: 'tr', title: 'Şartlar' }),
    );
  });

  it('read view falls back to legacy when no canonical addendum exists', async () => {
    const { service } = build({ addendumsWithType: [] });

    const fallback = [{ id: 'legacy', documentType: 'privacy_notice', translations: [] }];
    const view = await (service as any).buildStoreLegalDocumentsView(storeId, fallback);

    expect(view).toBe(fallback);
  });
});
