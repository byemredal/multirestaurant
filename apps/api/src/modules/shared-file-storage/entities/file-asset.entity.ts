/**
 * Access classification for a stored file (MR-DB-HARDENING-01 Slice 3).
 *   - 'public'         : safe to serve via an unauthenticated URL (e.g. store
 *                        slider images).
 *   - 'tenant_private' : sensitive tenant/onboarding document (KYC, bank, legal)
 *                        — must only be served through an authenticated stream,
 *                        never exposed as a raw public URL.
 */
export type FileAssetVisibility = 'public' | 'tenant_private';

export interface FileAsset {
  id: string;
  ownerTenantId: string | null;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  /** Defaults to 'tenant_private' on any unknown/default create path. */
  visibility: FileAssetVisibility;
  uploadedAt: Date;
}
