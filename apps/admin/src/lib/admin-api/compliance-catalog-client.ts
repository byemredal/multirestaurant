import { apiBaseUrl } from '@/lib/config';
import type { StoredAdminSession } from '@/lib/storage/admin-session';
import { parseJsonResponse } from './http';

export type ComplianceDocumentRequirement = {
  id: string;
  country: string;
  language: string;
  documentType: string;
  label: string;
  description: string;
  required: boolean;
  acceptedFormats: string[];
  guidanceOnly: boolean;
  active: boolean;
  sortOrder: number;
};

export type ComplianceConsentDefinition = {
  id: string;
  country: string;
  language: string;
  consentKey: string;
  label: string;
  description: string;
  documentCode: string;
  documentVersion: string;
  documentUrl: string | null;
  required: boolean;
  active: boolean;
  sortOrder: number;
};

export type ComplianceDocumentRequirementInput = Omit<ComplianceDocumentRequirement, 'id'>;
export type ComplianceConsentDefinitionInput = Omit<ComplianceConsentDefinition, 'id'>;

async function complianceRequest<T>(
  session: StoredAdminSession,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as { message?: string }).message
      : null;
    throw new Error(message || 'Compliance kataloğu işlemi tamamlanamadı.');
  }
  return payload as T;
}

export function listComplianceDocumentRequirements(session: StoredAdminSession) {
  return complianceRequest<ComplianceDocumentRequirement[]>(
    session,
    '/admin/compliance-catalog/document-requirements',
  );
}

export function createComplianceDocumentRequirement(
  session: StoredAdminSession,
  input: ComplianceDocumentRequirementInput,
) {
  return complianceRequest<ComplianceDocumentRequirement>(
    session,
    '/admin/compliance-catalog/document-requirements',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateComplianceDocumentRequirement(
  session: StoredAdminSession,
  id: string,
  input: Partial<ComplianceDocumentRequirementInput>,
) {
  return complianceRequest<ComplianceDocumentRequirement>(
    session,
    `/admin/compliance-catalog/document-requirements/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listComplianceConsentDefinitions(session: StoredAdminSession) {
  return complianceRequest<ComplianceConsentDefinition[]>(
    session,
    '/admin/compliance-catalog/consent-definitions',
  );
}

export function createComplianceConsentDefinition(
  session: StoredAdminSession,
  input: ComplianceConsentDefinitionInput,
) {
  return complianceRequest<ComplianceConsentDefinition>(
    session,
    '/admin/compliance-catalog/consent-definitions',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateComplianceConsentDefinition(
  session: StoredAdminSession,
  id: string,
  input: Partial<ComplianceConsentDefinitionInput>,
) {
  return complianceRequest<ComplianceConsentDefinition>(
    session,
    `/admin/compliance-catalog/consent-definitions/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
