import type { StoredAdminSession } from '@/lib/storage/admin-session';
import { parseJsonResponse } from './http';
import { adminAuthedFetch } from './authed-fetch';

export type AdminLegalDocumentType = {
  id: string;
  code: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
};

export type AdminLegalDocumentVersion = {
  id: string;
  documentId: string;
  versionLabel: string;
  locale: string;
  title: string;
  body: string;
  bodyFormat: 'markdown' | 'html' | 'plain_text';
  contentHashSha256: string;
  effectiveFrom: string;
  publishedAt: string;
  supersededAt: string | null;
  createdAt: string;
};

export type AdminLegalDocument = {
  id: string;
  typeId: string;
  typeCode: string | null;
  code: string;
  countryCode: string | null;
  audience: 'customer' | 'tenant' | 'all';
  isRequired: boolean;
  isActive: boolean;
  currentVersion: AdminLegalDocumentVersion | null;
};

export type ListLegalDocumentsParams = {
  countryCode?: string;
  locale?: string;
  audience?: 'customer' | 'tenant' | 'all';
  includeInactive?: boolean;
};

/** Error carrying the backend's machine-readable `code` (e.g. the placeholder guard). */
export class AdminLegalError extends Error {
  code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'AdminLegalError';
    this.code = code;
  }
}

async function adminLegalRequest<T>(
  _session: StoredAdminSession,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await adminAuthedFetch(path, init);

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    const record =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as { message?: string; code?: string })
        : null;
    const message = record?.message ?? `admin_legal_request_failed_${response.status}`;
    throw new AdminLegalError(message, record?.code ?? null);
  }

  const data = await parseJsonResponse(response);
  return data as T;
}

export async function listLegalDocumentTypes(session: StoredAdminSession) {
  const data = await adminLegalRequest<{ documentTypes: AdminLegalDocumentType[] }>(
    session,
    '/admin/legal/document-types',
  );
  return data.documentTypes;
}

export async function listLegalDocuments(
  session: StoredAdminSession,
  params: ListLegalDocumentsParams = {},
) {
  const query = new URLSearchParams();
  if (params.countryCode) query.set('countryCode', params.countryCode);
  if (params.locale) query.set('locale', params.locale);
  if (params.audience) query.set('audience', params.audience);
  query.set('includeInactive', String(params.includeInactive ?? true));
  const data = await adminLegalRequest<{ documents: AdminLegalDocument[] }>(
    session,
    `/admin/legal/documents?${query.toString()}`,
  );
  return data.documents;
}

export async function createLegalDocument(
  session: StoredAdminSession,
  body: {
    typeId: string;
    code: string;
    countryCode?: string;
    audience: 'customer' | 'tenant' | 'all';
    isRequired?: boolean;
    isActive?: boolean;
  },
) {
  return adminLegalRequest<AdminLegalDocument>(session, '/admin/legal/documents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateLegalDocument(
  session: StoredAdminSession,
  documentId: string,
  patch: {
    audience?: 'customer' | 'tenant' | 'all';
    isRequired?: boolean;
    isActive?: boolean;
  },
) {
  return adminLegalRequest<AdminLegalDocument>(
    session,
    `/admin/legal/documents/${documentId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function listDocumentVersions(
  session: StoredAdminSession,
  documentId: string,
) {
  const data = await adminLegalRequest<{ versions: AdminLegalDocumentVersion[] }>(
    session,
    `/admin/legal/documents/${documentId}/versions`,
  );
  return data.versions;
}

export async function publishDocumentVersion(
  session: StoredAdminSession,
  documentId: string,
  body: {
    versionLabel: string;
    locale: string;
    title: string;
    body: string;
    bodyFormat?: 'markdown' | 'html' | 'plain_text';
    effectiveFrom?: string;
    supersedeCurrent?: boolean;
  },
) {
  return adminLegalRequest<AdminLegalDocumentVersion>(
    session,
    `/admin/legal/documents/${documentId}/versions`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function supersedeVersion(
  session: StoredAdminSession,
  versionId: string,
) {
  return adminLegalRequest<{ ok: boolean }>(
    session,
    `/admin/legal/versions/${versionId}/supersede`,
    { method: 'POST' },
  );
}
