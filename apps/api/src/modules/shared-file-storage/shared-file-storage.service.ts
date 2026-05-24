import { Injectable } from '@nestjs/common';
import { SharedFileStorageStore } from './shared-file-storage.store';

@Injectable()
export class SharedFileStorageService {
  constructor(private readonly store: SharedFileStorageStore) {}

  registerTenantUpload(input: {
    ownerTenantId: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    publicUrl: string;
  }) {
    const storageKey = `tenant/${input.ownerTenantId}/${Date.now()}-${input.originalFileName}`;
    return this.store.create({
      ownerTenantId: input.ownerTenantId,
      storageKey,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      publicUrl: input.publicUrl,
    });
  }

  getAsset(assetId: string) {
    return this.store.findById(assetId);
  }
}
