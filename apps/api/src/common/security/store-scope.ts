import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-request.interface';

/**
 * Assertion helper used by every store-scoped service write to prove the
 * caller is allowed to touch the given store.
 *
 * Today this enforces:
 *   • Tenants can only act on stores they own (verified by the caller
 *     passing the `ownerTenantId` they read from the Store row).
 *   • Staff cannot reach store-scoped writes yet — the staff auth path
 *     is wired in a follow-up slice.
 *   • Admins are allowed (admin-only routes carry their own AuthTypes guard).
 *
 * The helper is intentionally pure — it does not query the database. The
 * caller is responsible for loading the store first; this is what keeps the
 * check tight (no extra round-trip) and the failure mode obvious (the caller
 * must look at the row anyway).
 */
export function assertStoreAccess(args: {
  user: AuthenticatedUser;
  ownerTenantId: string;
  /**
   * For staff: the list of store IDs the staff JWT carries. Pass `null` when
   * the caller is not staff; pass an empty array to deny by default.
   */
  staffStoreScope?: readonly string[] | null;
  storeId: string;
}): void {
  const { user, ownerTenantId, staffStoreScope, storeId } = args;

  if (user.type === 'admin') {
    return;
  }

  if (user.type === 'tenant') {
    if (user.id !== ownerTenantId) {
      throw new ForbiddenException('Tenant does not own this store.');
    }
    return;
  }

  if (user.type === 'staff') {
    if (!staffStoreScope || !staffStoreScope.includes(storeId)) {
      throw new ForbiddenException('Staff is not scoped to this store.');
    }
    return;
  }

  // Customer / unknown subject must never reach a store-scoped write.
  throw new ForbiddenException('Subject is not allowed on store-scoped routes.');
}
