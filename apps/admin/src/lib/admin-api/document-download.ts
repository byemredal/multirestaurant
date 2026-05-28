import { apiBaseUrl } from '@/lib/config';
import { readAdminSession } from '@/lib/storage/admin-session';

/**
 * Build an openable URL for a private onboarding document.
 *
 * Locally stored documents are served by the authenticated API stream
 * endpoint, returned by the API as a relative path (e.g.
 * `/admin/tenant-documents/{id}/file`). Because the link is opened via a plain
 * anchor that cannot send an `Authorization` header, the admin access token is
 * attached as the `access_token` query param (the same mechanism the API uses
 * for SSE streams). Externally hosted documents already carry an absolute URL
 * and are returned unchanged.
 *
 * Returns `null` when there is no file or no active session (client-only).
 */
export function buildDocumentDownloadUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }
  const session = readAdminSession();
  if (!session) {
    return null;
  }
  const separator = fileUrl.includes('?') ? '&' : '?';
  return `${apiBaseUrl}${fileUrl}${separator}access_token=${encodeURIComponent(session.accessToken)}`;
}
