import type { StoredAdminSession } from '@/lib/storage/admin-session';
import { parseJsonResponse } from './http';
import { adminAuthedFetch } from './authed-fetch';

/**
 * Client for the read-only platform-wide admin operational endpoints
 * (`GET /admin/orders`, `GET /admin/stores`). Oversight only — no mutations.
 * Routes through adminAuthedFetch so 401s trigger silent refresh + retry; an
 * unrecoverable auth failure raises AuthExpiredError after redirecting.
 */
async function adminGet<T>(
  _session: StoredAdminSession,
  path: string,
): Promise<T> {
  const response = await adminAuthedFetch(path);

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    let message = `admin_request_failed_${response.status}`;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const candidate = payload as { message?: string | string[] };
      if (Array.isArray(candidate.message) && candidate.message.length > 0) {
        message = candidate.message.join(', ');
      } else if (typeof candidate.message === 'string' && candidate.message.trim()) {
        message = candidate.message;
      }
    }
    throw new Error(message);
  }

  return parseJsonResponse(response) as Promise<T>;
}

export type AdminOrderCustomerSummary = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
};

export type AdminOrderRow = {
  id: string;
  storeId: string;
  storeName: string;
  status: string;
  subtotalAmount: number;
  totalAmount: number;
  currencySnapshot: string;
  serviceTypeSnapshot: string | null;
  paymentMethodSnapshot: string | null;
  itemCount: number;
  isActionable: boolean;
  createdAt: string;
  customerSummary: AdminOrderCustomerSummary;
};

export type AdminStoreRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  isActive: boolean;
  onboardingStatus: string;
  city: string | null;
  country: string | null;
  imageUrl: string | null;
  createdAt: string;
  ownerCompanyName: string | null;
  menuItemCount: number;
};

export function listAdminOrders(session: StoredAdminSession) {
  return adminGet<AdminOrderRow[]>(session, '/admin/orders');
}

export function listAdminStores(session: StoredAdminSession) {
  return adminGet<AdminStoreRow[]>(session, '/admin/stores');
}
