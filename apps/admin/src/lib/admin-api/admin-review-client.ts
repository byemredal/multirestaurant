import { apiBaseUrl } from '@/lib/config';
import type { StoredAdminSession } from '@/lib/storage/admin-session';
import { onAuthExpired, refreshAdminSession } from '@/lib/auth/auth-expiry';
import { parseJsonResponse } from './http';
import type {
  ApplicationListEntry,
  AuditLogEntry,
  TenantApplicationDetail,
  TenantBusinessOverview,
  TenantDocumentQueueEntry,
} from './admin-review-types';

function rawAdminFetch(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

async function adminRequest(
  session: StoredAdminSession,
  path: string,
  init?: RequestInit,
) {
  let response = await rawAdminFetch(session.accessToken, path, init);

  // Expired access token — single-flight silent refresh, then retry once.
  if (response.status === 401) {
    const refreshed = await refreshAdminSession();
    if (refreshed) {
      response = await rawAdminFetch(refreshed.accessToken, path, init);
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('admin_session_expired');
      }
    } else {
      onAuthExpired();
      throw new Error('admin_session_expired');
    }
  }

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    let message = `admin_request_failed_${response.status}`;

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const candidate = payload as {
        message?: string | string[];
        error?: string | { message?: string | string[]; error?: string } | null;
      };

      if (Array.isArray(candidate.message) && candidate.message.length > 0) {
        message = candidate.message.join(', ');
      } else if (typeof candidate.message === 'string' && candidate.message.trim()) {
        message = candidate.message;
      } else if (typeof candidate.error === 'string' && candidate.error.trim()) {
        message = candidate.error;
      } else if (candidate.error && typeof candidate.error === 'object') {
        const nested = candidate.error;
        if (Array.isArray(nested.message) && nested.message.length > 0) {
          message = nested.message.join(', ');
        } else if (typeof nested.message === 'string' && nested.message.trim()) {
          message = nested.message;
        } else if (typeof nested.error === 'string' && nested.error.trim()) {
          message = nested.error;
        }
      }
    } else if (typeof payload === 'string' && payload.trim()) {
      message = payload;
    }

    throw new Error(message);
  }

  return parseJsonResponse(response);
}

export function listTenantApplications(
  session: StoredAdminSession,
  query?: string,
) {
  return adminRequest(
    session,
    `/admin/tenant-applications${query ? `?${query}` : ''}`,
  ) as Promise<ApplicationListEntry[]>;
}

export function getTenantApplication(
  session: StoredAdminSession,
  applicationId: string,
) {
  return adminRequest(
    session,
    `/admin/tenant-applications/${applicationId}`,
  ) as Promise<TenantApplicationDetail>;
}

export function getTenantApplicationTimeline(
  session: StoredAdminSession,
  applicationId: string,
) {
  return adminRequest(
    session,
    `/admin/tenant-applications/${applicationId}/timeline`,
  ) as Promise<AuditLogEntry[]>;
}

export function requestApplicationRevision(
  session: StoredAdminSession,
  applicationId: string,
  input: { internalNote?: string; tenantVisibleNote?: string },
) {
  return adminRequest(
    session,
    `/admin/tenant-applications/${applicationId}/request-revision`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export type ApprovePasswordSetupResult = {
  deliveryStatus: 'queued' | 'sent' | 'failed' | 'unavailable';
  deliveryErrorCode: string | null;
  sentToEmail: string | null;
  tokenIssued: boolean;
  debugLink?: string | null;
};

export type ApproveApplicationResult = {
  id?: string;
  status?: string;
  passwordSetup?: ApprovePasswordSetupResult | null;
};

export async function approveApplication(
  session: StoredAdminSession,
  applicationId: string,
  input: { internalNote?: string; tenantVisibleNote?: string },
): Promise<ApproveApplicationResult> {
  const result = await adminRequest(
    session,
    `/admin/tenant-applications/${applicationId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return (result ?? {}) as ApproveApplicationResult;
}

export function rejectApplication(
  session: StoredAdminSession,
  applicationId: string,
  input: { internalNote?: string; tenantVisibleNote?: string },
) {
  return adminRequest(
    session,
    `/admin/tenant-applications/${applicationId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export type ResendPasswordSetupResult = {
  passwordSetup: ApprovePasswordSetupResult;
};

export async function resendPasswordSetupLink(
  session: StoredAdminSession,
  applicationId: string,
): Promise<ResendPasswordSetupResult> {
  const result = await adminRequest(
    session,
    `/admin/tenant-applications/${applicationId}/password-setup/resend`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
  return (result ?? { passwordSetup: null }) as ResendPasswordSetupResult;
}

export function listTenantDocuments(session: StoredAdminSession) {
  return adminRequest(
    session,
    '/admin/tenant-documents',
  ) as Promise<TenantDocumentQueueEntry[]>;
}

export function getTenantDocument(
  session: StoredAdminSession,
  documentId: string,
) {
  return adminRequest(session, `/admin/tenant-documents/${documentId}`);
}

export function approveTenantDocument(
  session: StoredAdminSession,
  documentId: string,
  note?: string,
) {
  return adminRequest(session, `/admin/tenant-documents/${documentId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note: note ?? '' }),
  });
}

export function rejectTenantDocument(
  session: StoredAdminSession,
  documentId: string,
  note?: string,
) {
  return adminRequest(session, `/admin/tenant-documents/${documentId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note: note ?? '' }),
  });
}

export function requestTenantDocumentRevision(
  session: StoredAdminSession,
  documentId: string,
  note?: string,
) {
  return adminRequest(
    session,
    `/admin/tenant-documents/${documentId}/request-revision`,
    {
      method: 'POST',
      body: JSON.stringify({ note: note ?? '' }),
    },
  );
}

export function activateTenant(
  session: StoredAdminSession,
  tenantId: string,
) {
  return adminRequest(session, `/admin/tenants/${tenantId}/activate`, {
    method: 'POST',
  });
}

export function suspendTenant(
  session: StoredAdminSession,
  tenantId: string,
  reason?: string,
) {
  return adminRequest(session, `/admin/tenants/${tenantId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? '' }),
  });
}

export function reopenTenantReview(
  session: StoredAdminSession,
  tenantId: string,
) {
  return adminRequest(session, `/admin/tenants/${tenantId}/reopen-review`, {
    method: 'POST',
  });
}

export function listTenants(
  session: StoredAdminSession,
  query?: string,
) {
  return adminRequest(
    session,
    `/admin/tenants${query ? `?${query}` : ''}`,
  ) as Promise<ApplicationListEntry[]>;
}

export function getTenantBusinessOverview(
  session: StoredAdminSession,
  tenantId: string,
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/overview`,
  ) as Promise<TenantBusinessOverview>;
}

export function updateTenantStoreTaxSettings(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  input: {
    taxRegistrationNumber?: string | null;
    priceIncludesTax?: boolean;
    defaultVatRate?: number;
    serviceChargeRate?: number;
    invoiceFooterText?: string | null;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/tax-settings`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function updateTenantStoreDeliveryFeeSettings(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  input: {
    baseFee?: number;
    freeDeliveryThreshold?: number | null;
    surgeFeeEnabled?: boolean;
    smallOrderFee?: number;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/delivery-fee-settings`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function updateTenantStoreReservationSettings(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  input: {
    enabled?: boolean;
    requiresApproval?: boolean;
    maxPartySize?: number | null;
    defaultSlotMinutes?: number;
    leadTimeMinutes?: number;
    notes?: string | null;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/reservation-settings`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function updateTenantStoreReceiptSettings(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  input: {
    headerText?: string | null;
    footerText?: string | null;
    showTaxBreakdown?: boolean;
    showQrCode?: boolean;
    layoutConfigJson?: Record<string, unknown>;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/receipt-settings`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function updateTenantStoreLegalDocument(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  documentType: 'terms_and_conditions' | 'privacy_notice' | 'distance_sales',
  input: {
    versionLabel?: string;
    isPublished?: boolean;
    effectiveFrom?: string | null;
    translations: Array<{ locale: string; title: string; body: string }>;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/legal-documents/${documentType}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function updateTenantStoreProfileNote(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  noteType: 'profile' | 'story' | 'operational',
  input: {
    isPublished?: boolean;
    translations: Array<{ locale: string; title?: string | null; body: string }>;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/profile-notes/${noteType}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function createTenantStoreSlider(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  input: { name: string; sliderType: 'homepage' | 'campaign' | 'seasonal'; isActive?: boolean },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/sliders`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateTenantStoreSlider(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  sliderId: string,
  input: { name?: string; sliderType?: 'homepage' | 'campaign' | 'seasonal'; isActive?: boolean },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/sliders/${sliderId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function deleteTenantStoreSlider(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  sliderId: string,
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/sliders/${sliderId}`,
    { method: 'DELETE' },
  );
}

export function createTenantStoreSliderItem(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  sliderId: string,
  input: {
    imageAssetId?: string | null;
    title?: string | null;
    caption?: string | null;
    targetUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/sliders/${sliderId}/items`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateTenantStoreSliderItem(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  sliderId: string,
  itemId: string,
  input: {
    imageAssetId?: string | null;
    title?: string | null;
    caption?: string | null;
    targetUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/sliders/${sliderId}/items/${itemId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function deleteTenantStoreSliderItem(
  session: StoredAdminSession,
  tenantId: string,
  storeId: string,
  sliderId: string,
  itemId: string,
) {
  return adminRequest(
    session,
    `/admin/tenants/${tenantId}/stores/${storeId}/sliders/${sliderId}/items/${itemId}`,
    { method: 'DELETE' },
  );
}
