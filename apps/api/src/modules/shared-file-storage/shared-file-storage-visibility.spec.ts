import { SharedFileStorageService } from './shared-file-storage.service';
import { SharedFileStorageStore } from './shared-file-storage.store';

/**
 * MR-DB-HARDENING-01 Slice 3 — FileAsset visibility defaults at the create
 * paths. Unclassified uploads must default to the safe 'tenant_private', and
 * tenant document uploads must always be private.
 */
describe('FileAsset visibility on create', () => {
  describe('SharedFileStorageStore.create', () => {
    function buildStore() {
      const run = jest.fn().mockResolvedValue({ rowCount: 1 });
      const prepare = jest.fn(() => ({ run }));
      const store = new SharedFileStorageStore({ prepare } as any);
      return { store, run };
    }

    const baseInput = {
      ownerTenantId: 'tenant-1',
      storageKey: 'k',
      originalFileName: 'f.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      publicUrl: 'uploads/f.pdf',
    };

    it("defaults to 'tenant_private' when visibility is omitted", async () => {
      const { store, run } = buildStore();
      const asset = await store.create({ ...baseInput });
      expect(asset.visibility).toBe('tenant_private');
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ $visibility: 'tenant_private' }),
      );
    });

    it("persists an explicit 'public' classification", async () => {
      const { store, run } = buildStore();
      const asset = await store.create({ ...baseInput, visibility: 'public' });
      expect(asset.visibility).toBe('public');
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ $visibility: 'public' }),
      );
    });
  });

  describe('SharedFileStorageService.registerTenantUpload', () => {
    it("classifies tenant document uploads as 'tenant_private'", async () => {
      const create = jest.fn().mockResolvedValue({ id: 'a1' });
      const service = new SharedFileStorageService({ create } as any);

      await service.registerTenantUpload({
        ownerTenantId: 'tenant-1',
        originalFileName: 'license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        publicUrl: 'uploads/license.pdf',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'tenant_private' }),
      );
    });
  });
});
