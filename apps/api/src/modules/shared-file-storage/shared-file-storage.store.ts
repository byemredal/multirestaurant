import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { FileAsset, FileAssetVisibility } from './entities/file-asset.entity';

// visibility is optional on input: any caller that does not classify the asset
// gets the safe 'tenant_private' default (MR-DB-HARDENING-01 Slice 3).
type CreateFileAssetInput = Omit<FileAsset, 'id' | 'uploadedAt' | 'visibility'> & {
  visibility?: FileAssetVisibility;
};

@Injectable()
export class SharedFileStorageStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: CreateFileAssetInput): Promise<FileAsset> {
    const asset: FileAsset = {
      ...input,
      // Safe-by-default: unclassified uploads are treated as private.
      visibility: input.visibility ?? 'tenant_private',
      id: randomUUID(),
      uploadedAt: new Date(),
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "FileAsset" (
          "id", "ownerTenantId", "storageKey", "originalFileName", "mimeType",
          "sizeBytes", "publicUrl", "visibility", "uploadedAt"
        ) VALUES (
          $id, $ownerTenantId, $storageKey, $originalFileName, $mimeType,
          $sizeBytes, $publicUrl, $visibility, $uploadedAt
        )`,
      )
      .run({
        $id: asset.id,
        $ownerTenantId: asset.ownerTenantId,
        $storageKey: asset.storageKey,
        $originalFileName: asset.originalFileName,
        $mimeType: asset.mimeType,
        $sizeBytes: asset.sizeBytes,
        $publicUrl: asset.publicUrl,
        $visibility: asset.visibility,
        $uploadedAt: asset.uploadedAt.toISOString(),
      });

    return asset;
  }

  async findById(id: string): Promise<FileAsset | null> {
    const row = await this.databaseService
      .prepare(`SELECT * FROM "FileAsset" WHERE "id" = $id`)
      .get({ $id: id }) as FileAssetRow | undefined;

    return row ? this.map(row) : null;
  }

  private map(row: FileAssetRow): FileAsset {
    return {
      id: row.id,
      ownerTenantId: row.ownerTenantId,
      storageKey: row.storageKey,
      originalFileName: row.originalFileName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      publicUrl: row.publicUrl,
      // Legacy rows predating the column read as NULL → treat as private.
      visibility: row.visibility === 'public' ? 'public' : 'tenant_private',
      uploadedAt: new Date(row.uploadedAt),
    };
  }
}

interface FileAssetRow {
  id: string;
  ownerTenantId: string | null;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number | string;
  publicUrl: string;
  visibility: FileAssetVisibility | null;
  uploadedAt: string;
}
