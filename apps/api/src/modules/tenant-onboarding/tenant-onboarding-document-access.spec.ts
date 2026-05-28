import { NotFoundException } from '@nestjs/common';
import { TenantOnboardingService } from './tenant-onboarding.service';

describe('TenantOnboardingService private document streaming authorization', () => {
  const streamSentinel = { __streamable: true } as any;

  function buildService(store: any, fileStorage: any) {
    return new TenantOnboardingService(
      store,
      {} as any,
      fileStorage,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  describe('streamDocumentForAdmin', () => {
    it('throws when the document does not exist', async () => {
      const service = buildService({ findDocumentById: jest.fn().mockResolvedValue(null) }, {});
      await expect(service.streamDocumentForAdmin('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the backing file asset is missing', async () => {
      const service = buildService(
        { findDocumentById: jest.fn().mockResolvedValue({ id: 'doc-1', fileAssetId: 'asset-1' }) },
        { getAsset: jest.fn().mockResolvedValue(null) },
      );
      await expect(service.streamDocumentForAdmin('doc-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('streams the asset for an admin reviewer', async () => {
      const asset = { id: 'asset-1', mimeType: 'application/pdf' };
      const openDocumentStream = jest.fn().mockResolvedValue(streamSentinel);
      const service = buildService(
        { findDocumentById: jest.fn().mockResolvedValue({ id: 'doc-1', fileAssetId: 'asset-1' }) },
        { getAsset: jest.fn().mockResolvedValue(asset), openDocumentStream },
      );

      await expect(service.streamDocumentForAdmin('doc-1')).resolves.toBe(streamSentinel);
      expect(openDocumentStream).toHaveBeenCalledWith(asset, 'inline');
    });
  });

  describe('streamOwnDocument', () => {
    it('throws when the document does not exist', async () => {
      const service = buildService({ findDocumentById: jest.fn().mockResolvedValue(null) }, {});
      await expect(service.streamOwnDocument('tenant-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a document that belongs to another tenant (cross-tenant IDOR)', async () => {
      const openDocumentStream = jest.fn();
      const service = buildService(
        {
          findDocumentById: jest.fn().mockResolvedValue({ id: 'doc-1', applicationId: 'app-other' }),
          findApplicationByTenantId: jest.fn().mockResolvedValue({ id: 'app-mine' }),
        },
        { getAsset: jest.fn(), openDocumentStream },
      );

      await expect(service.streamOwnDocument('tenant-1', 'doc-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(openDocumentStream).not.toHaveBeenCalled();
    });

    it('rejects when the caller has no application', async () => {
      const service = buildService(
        {
          findDocumentById: jest.fn().mockResolvedValue({ id: 'doc-1', applicationId: 'app-1' }),
          findApplicationByTenantId: jest.fn().mockResolvedValue(null),
        },
        { getAsset: jest.fn(), openDocumentStream: jest.fn() },
      );
      await expect(service.streamOwnDocument('tenant-1', 'doc-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('streams the document when it belongs to the calling tenant', async () => {
      const asset = { id: 'asset-1', mimeType: 'image/png' };
      const openDocumentStream = jest.fn().mockResolvedValue(streamSentinel);
      const service = buildService(
        {
          findDocumentById: jest
            .fn()
            .mockResolvedValue({ id: 'doc-1', applicationId: 'app-1', fileAssetId: 'asset-1' }),
          findApplicationByTenantId: jest.fn().mockResolvedValue({ id: 'app-1' }),
        },
        { getAsset: jest.fn().mockResolvedValue(asset), openDocumentStream },
      );

      await expect(service.streamOwnDocument('tenant-1', 'doc-1')).resolves.toBe(streamSentinel);
      expect(openDocumentStream).toHaveBeenCalledWith(asset, 'inline');
    });
  });
});
