import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { FileAsset } from './entities/file-asset.entity';
import { SharedFileStorageStore } from './shared-file-storage.store';

/** Strip directories and unsafe characters so the value is safe to place in a
 * `Content-Disposition` header (prevents header injection / path leakage). */
function sanitizeDownloadFileName(name: string | null | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'document';
}

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

  /**
   * Resolve a stored asset to an absolute path that is guaranteed to live
   * inside the local `uploads/` root. Throws `NotFoundException` for remote
   * URLs (externally hosted assets are not streamed by us) and for any path
   * that escapes the uploads root — which is the path-traversal guard.
   *
   * Kept side-effect free (no filesystem access) so it can be unit tested.
   */
  resolveLocalFilePath(asset: Pick<FileAsset, 'publicUrl'>): string {
    const storedPath = asset.publicUrl ?? '';
    // Reject remote URLs (http://, https://, file://, …). Windows drive paths
    // like `E:\...` do not match because they lack the `//` after the colon.
    if (storedPath.length === 0 || /^[a-z][a-z0-9+.-]*:\/\//i.test(storedPath)) {
      throw new NotFoundException('Document is not available for secure download.');
    }

    const uploadsRoot = resolve(process.cwd(), 'uploads');
    const candidate = resolve(storedPath);
    if (candidate !== uploadsRoot && !candidate.startsWith(uploadsRoot + sep)) {
      throw new NotFoundException('Document path is not permitted.');
    }

    return candidate;
  }

  /**
   * Open an authenticated read stream for a stored document. Authorization
   * (admin role / tenant ownership) MUST be enforced by the caller before
   * invoking this. Returns a `StreamableFile` with the correct content type
   * and a sanitized `Content-Disposition` filename.
   */
  async openDocumentStream(
    asset: FileAsset,
    disposition: 'inline' | 'attachment' = 'inline',
  ): Promise<StreamableFile> {
    const filePath = this.resolveLocalFilePath(asset);

    let size: number;
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        throw new Error('not_a_regular_file');
      }
      size = stats.size;
    } catch {
      throw new NotFoundException('Stored document file could not be read.');
    }

    return new StreamableFile(createReadStream(filePath), {
      type: asset.mimeType || 'application/octet-stream',
      disposition: `${disposition}; filename="${sanitizeDownloadFileName(asset.originalFileName)}"`,
      length: size,
    });
  }
}
