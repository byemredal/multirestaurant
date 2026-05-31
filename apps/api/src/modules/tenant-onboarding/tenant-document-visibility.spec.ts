import { TenantOnboardingService } from './tenant-onboarding.service';

/**
 * MR-DB-HARDENING-01 Slice 3 — a tenant_private FileAsset must never be exposed
 * as a raw public URL in document responses, even if its stored publicUrl is an
 * absolute https URL. It must instead route through the authenticated streaming
 * endpoint. A genuinely 'public' asset keeps its absolute URL.
 */
describe('TenantOnboardingService document URL privacy', () => {
  function buildService(fileStorage: any) {
    const store = {
      listAllCurrentDocuments: jest
        .fn()
        .mockResolvedValue([{ id: 'doc-1', applicationId: 'app-1', fileAssetId: 'asset-1' }]),
      findApplicationById: jest.fn().mockResolvedValue({ id: 'app-1' }),
      findTenantAccountByApplicationId: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
    };
    return new TenantOnboardingService(
      store as any,
      {} as any,
      fileStorage,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('does NOT leak the raw publicUrl of a tenant_private asset (uses the auth stream URL)', async () => {
    const service = buildService({
      getAsset: jest.fn().mockResolvedValue({
        id: 'asset-1',
        originalFileName: 'kyc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        // Even an absolute https URL must NOT be surfaced for a private doc.
        publicUrl: 'https://cdn.example.com/kyc.pdf',
        visibility: 'tenant_private',
      }),
    });

    const [entry] = await service.listDocumentsForAdmin();

    expect(entry.fileUrl).toBe('/admin/tenant-documents/doc-1/file');
    expect(entry.fileUrl).not.toContain('cdn.example.com');
    expect(entry.document.fileUrl).toBe('/admin/tenant-documents/doc-1/file');
  });

  it('keeps the absolute URL for an explicitly public asset', async () => {
    const service = buildService({
      getAsset: jest.fn().mockResolvedValue({
        id: 'asset-1',
        originalFileName: 'banner.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        publicUrl: 'https://cdn.example.com/banner.jpg',
        visibility: 'public',
      }),
    });

    const [entry] = await service.listDocumentsForAdmin();

    expect(entry.fileUrl).toBe('https://cdn.example.com/banner.jpg');
  });
});
