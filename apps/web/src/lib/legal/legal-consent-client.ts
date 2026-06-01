import { apiClient } from '@/lib/api/api-client';
import { webAuthedFetch } from '@/lib/api/authed-fetch';
import { apiBaseUrl } from '@/lib/config';

const API_BASE_URL = apiBaseUrl;

export type LegalDocumentAudience = 'customer' | 'tenant' | 'all';

export type LegalDocumentBundle = {
  id: string;
  typeId: string;
  typeCode: string | null;
  code: string;
  audience: LegalDocumentAudience;
  isRequired: boolean;
  isActive: boolean;
  currentVersion: {
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
  } | null;
};

export type ConsentChannel =
  | 'web'
  | 'ios'
  | 'android'
  | 'tenant-portal'
  | 'admin-portal'
  | 'in-store'
  | 'api';

export type ConsentEntry = {
  documentVersionId: string;
  action?: 'granted' | 'revoked' | 'renewed';
  contextRef?: string;
};

export async function fetchActiveLegalDocuments(
  audience: LegalDocumentAudience = 'customer',
  locale = 'tr',
): Promise<LegalDocumentBundle[]> {
  const result = await apiClient({
    method: 'GET',
    url: `${API_BASE_URL}/public/legal/documents/active?audience=${encodeURIComponent(
      audience,
    )}&locale=${encodeURIComponent(locale)}`,
  });
  if (!result.ok) {
    throw new Error(`Failed to load legal documents (HTTP ${result.status}).`);
  }
  const data = (result.data as { documents?: LegalDocumentBundle[] }) ?? {};
  return data.documents ?? [];
}

export async function recordAnonymousConsent(input: {
  channel: ConsentChannel;
  anonymousIdentifier: string;
  entries: ConsentEntry[];
}): Promise<void> {
  const result = await apiClient({
    method: 'POST',
    url: `${API_BASE_URL}/public/legal/consents/anonymous`,
    body: input,
  });
  if (!result.ok) {
    throw new Error(
      `Failed to record anonymous consent (HTTP ${result.status}).`,
    );
  }
}

export type ReConsentStatus = {
  requires: boolean;
  missingDocumentCodes: string[];
};

export async function fetchCustomerReConsentStatus(
  token: string,
): Promise<ReConsentStatus> {
  const result = await apiClient({
    method: 'GET',
    url: `${API_BASE_URL}/me/legal/re-consent-required`,
    token,
  });
  if (!result.ok) {
    throw new Error(`Failed to fetch re-consent status (HTTP ${result.status}).`);
  }
  const data = (result.data as ReConsentStatus | null) ?? {
    requires: false,
    missingDocumentCodes: [],
  };
  return data;
}

export async function fetchTenantReConsentStatus(
  token: string,
): Promise<ReConsentStatus> {
  const result = await apiClient({
    method: 'GET',
    url: `${API_BASE_URL}/tenant/legal/re-consent-required`,
    token,
  });
  if (!result.ok) {
    throw new Error(`Failed to fetch tenant re-consent status (HTTP ${result.status}).`);
  }
  const data = (result.data as ReConsentStatus | null) ?? {
    requires: false,
    missingDocumentCodes: [],
  };
  return data;
}

export async function recordTenantConsent(input: {
  token: string;
  channel: ConsentChannel;
  entries: ConsentEntry[];
}): Promise<void> {
  const result = await apiClient({
    method: 'POST',
    url: `${API_BASE_URL}/tenant/legal/consents`,
    token: input.token,
    body: { channel: input.channel, entries: input.entries },
  });
  if (!result.ok) {
    throw new Error(`Failed to record tenant consent (HTTP ${result.status}).`);
  }
}

export type MarketingConsentChannel = 'email' | 'sms' | 'push' | 'call';

export type MarketingConsentSnapshot = {
  channel: MarketingConsentChannel;
  isGranted: boolean;
  lastChangedAt: string | null;
  source: string | null;
  iysReferenceId: string | null;
};

export async function fetchCustomerMarketingConsents(
  token: string,
): Promise<MarketingConsentSnapshot[]> {
  const result = await apiClient({
    method: 'GET',
    url: `${API_BASE_URL}/me/legal/marketing-consents`,
    token,
  });
  if (!result.ok) {
    throw new Error(`Failed to fetch marketing consents (HTTP ${result.status}).`);
  }
  const data = result.data as { marketingConsents?: MarketingConsentSnapshot[] } | null;
  return data?.marketingConsents ?? [];
}

export async function upsertCustomerMarketingConsents(input: {
  token: string;
  entries: Array<{
    channel: MarketingConsentChannel;
    action: 'granted' | 'revoked';
    source?: string;
  }>;
}): Promise<void> {
  const result = await apiClient({
    method: 'POST',
    url: `${API_BASE_URL}/me/legal/marketing-consents`,
    token: input.token,
    body: { entries: input.entries },
  });
  if (!result.ok) {
    throw new Error(`Failed to update marketing consents (HTTP ${result.status}).`);
  }
}

export type ConsentHistoryEntry = {
  id: string;
  subjectType: 'customer' | 'tenant' | 'anonymous';
  customerAccountId: string | null;
  tenantAccountId: string | null;
  documentVersionId: string;
  action: 'granted' | 'revoked' | 'renewed';
  ipAddress: string | null;
  userAgent: string | null;
  channel: string;
  contextRef: string | null;
  acceptedAt: string;
  createdAt: string;
};

export async function fetchCustomerConsentHistory(
  token: string,
): Promise<ConsentHistoryEntry[]> {
  const result = await apiClient({
    method: 'GET',
    url: `${API_BASE_URL}/me/legal/consents`,
    token,
  });
  if (!result.ok) {
    throw new Error(`Failed to fetch consent history (HTTP ${result.status}).`);
  }
  const data = result.data as { consents?: ConsentHistoryEntry[] } | null;
  return data?.consents ?? [];
}

export async function recordCustomerConsent(input: {
  token: string;
  channel: ConsentChannel;
  entries: ConsentEntry[];
}): Promise<void> {
  const result = await apiClient({
    method: 'POST',
    url: `${API_BASE_URL}/me/legal/consents`,
    token: input.token,
    body: { channel: input.channel, entries: input.entries },
  });
  if (!result.ok) {
    throw new Error(`Failed to record customer consent (HTTP ${result.status}).`);
  }
}

export async function createOrderLegalAcceptance(input: {
  token: string;
  orderId: string;
  distanceSalesContractVersionId: string;
  preInformationFormVersionId: string;
}): Promise<void> {
  const result = await webAuthedFetch('/checkout/legal-acceptance', {
    method: 'POST',
    body: JSON.stringify({
      orderId: input.orderId,
      distanceSalesContractVersionId: input.distanceSalesContractVersionId,
      preInformationFormVersionId: input.preInformationFormVersionId,
    }),
  });
  if (!result.ok) {
    throw new Error(
      `Failed to record order legal acceptance (HTTP ${result.status}).`,
    );
  }
}

/**
 * Convenience: given the active document bundle, pick the version IDs needed
 * for OrderLegalAcceptance (distance-sales contract + pre-information form).
 * Returns null when either required document is missing — UI should handle
 * this as a blocker (admin has not configured the documents yet).
 */
export function pickOrderAcceptanceVersionIds(
  documents: LegalDocumentBundle[],
): { distanceSalesContractVersionId: string; preInformationFormVersionId: string } | null {
  const distance = documents.find(
    (doc) => doc.typeCode === 'distance_sales_contract' && doc.currentVersion,
  );
  const preInfo = documents.find(
    (doc) => doc.typeCode === 'pre_information_form' && doc.currentVersion,
  );
  if (!distance?.currentVersion || !preInfo?.currentVersion) {
    return null;
  }
  return {
    distanceSalesContractVersionId: distance.currentVersion.id,
    preInformationFormVersionId: preInfo.currentVersion.id,
  };
}

/**
 * Filter active documents to the cookie-policy entry (used by the cookie bar).
 * Returns the bundle when present, null otherwise — UI should still allow
 * the user to choose cookie preferences locally and skip the backend POST
 * if no cookie policy is configured.
 */
export function pickCookiePolicyVersionId(
  documents: LegalDocumentBundle[],
): string | null {
  const cookie = documents.find(
    (doc) => doc.typeCode === 'cookie_policy' && doc.currentVersion,
  );
  return cookie?.currentVersion?.id ?? null;
}
