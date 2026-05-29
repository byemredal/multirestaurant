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
  audience: 'customer' | 'tenant' | 'all';
  isRequired: boolean;
  isActive: boolean;
  currentVersion: AdminLegalDocumentVersion | null;
};

async function adminLegalRequest<T>(
  _session: StoredAdminSession,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await adminAuthedFetch(path, init);

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    const message =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? ((payload as { message?: string }).message ??
          `admin_legal_request_failed_${response.status}`)
        : `admin_legal_request_failed_${response.status}`;
    throw new Error(message);
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

export async function listLegalDocuments(session: StoredAdminSession) {
  const data = await adminLegalRequest<{ documents: AdminLegalDocument[] }>(
    session,
    '/admin/legal/documents?includeInactive=true',
  );
  return data.documents;
}

export async function createLegalDocument(
  session: StoredAdminSession,
  body: {
    typeId: string;
    code: string;
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
