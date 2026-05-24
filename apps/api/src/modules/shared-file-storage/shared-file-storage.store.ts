import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { FileAsset } from './entities/file-asset.entity';

type CreateFileAssetInput = Omit<FileAsset, 'id' | 'uploadedAt'>;

@Injectable()
export class SharedFileStorageStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: CreateFileAssetInput): Promise<FileAsset> {
    const asset: FileAsset = {
      ...input,
      id: randomUUID(),
      uploadedAt: new Date(),
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "FileAsset" (
          "id", "ownerTenantId", "storageKey", "originalFileName", "mimeType",
          "sizeBytes", "publicUrl", "uploadedAt"
        ) VALUES (
          $id, $ownerTenantId, $storageKey, $originalFileName, $mimeType,
          $sizeBytes, $publicUrl, $uploadedAt
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
  uploadedAt: string;
}
