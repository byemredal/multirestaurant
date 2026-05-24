export interface FileAsset {
  id: string;
  ownerTenantId: string | null;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  uploadedAt: Date;
}
