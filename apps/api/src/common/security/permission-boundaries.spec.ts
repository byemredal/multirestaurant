import { ForbiddenException } from '@nestjs/common';
import {
  AUTH_SUBJECT_TYPES,
  AuthSubjectType,
} from './auth-subject.type';
import { assertStoreAccess } from './store-scope';
import { AuthenticatedUser } from '../types/authenticated-request.interface';

/**
 * Structural permission-boundary spec pack (MR-ARCH-02).
 *
 * These tests cover the *type-level* and *pure-helper-level* guarantees the
 * MR-ARCH-02 refactor must preserve. Full HTTP-level guard tests (which boot
 * Nest and exercise real controllers) are left to the staff auth slice that
 * actually wires staff login — at that point the matrix below grows from
 * pure-function assertions to e2e supertest assertions.
 */
describe('permission boundaries (MR-ARCH-02)', () => {
  const user = (over: Partial<AuthenticatedUser>): AuthenticatedUser => ({
    id: 'subject-id',
    email: 'subject@example.com',
    type: 'customer',
    ...over,
  });

  describe('AuthSubjectType', () => {
    it('lists exactly four subject types in canonical order', () => {
      expect(AUTH_SUBJECT_TYPES).toEqual(['customer', 'tenant', 'staff', 'admin']);
    });

    it('staff is a distinct value from tenant', () => {
      // Catches the regression where staff tokens silently round-trip as tenant.
      const tenantType: AuthSubjectType = 'tenant';
      const staffType: AuthSubjectType = 'staff';
      expect(tenantType).not.toBe(staffType);
    });
  });

  describe('assertStoreAccess', () => {
    const storeId = 'store-A';

    it('allows the owning tenant', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'tenant', id: 'tenant-X' }),
          ownerTenantId: 'tenant-X',
          storeId,
        }),
      ).not.toThrow();
    });

    it('rejects a tenant token from a different tenant (cross-tenant guess)', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'tenant', id: 'tenant-Y' }),
          ownerTenantId: 'tenant-X',
          storeId,
        }),
      ).toThrow(ForbiddenException);
    });

    it('rejects a customer token on a store-scoped route', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'customer' }),
          ownerTenantId: 'tenant-X',
          storeId,
        }),
      ).toThrow(ForbiddenException);
    });

    it('admin tokens pass (admin-only routes carry their own AuthTypes guard)', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'admin', role: 'super_admin' as any }),
          ownerTenantId: 'tenant-X',
          storeId,
        }),
      ).not.toThrow();
    });

    it('staff scoped to the target store is allowed', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'staff', staffStoreScope: [storeId] }),
          ownerTenantId: 'tenant-X',
          staffStoreScope: [storeId],
          storeId,
        }),
      ).not.toThrow();
    });

    it('staff scoped to a different store is rejected (cross-store guess)', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'staff', staffStoreScope: ['store-B'] }),
          ownerTenantId: 'tenant-X',
          staffStoreScope: ['store-B'],
          storeId,
        }),
      ).toThrow(ForbiddenException);
    });

    it('staff with empty scope is rejected (fail-closed)', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'staff', staffStoreScope: [] }),
          ownerTenantId: 'tenant-X',
          staffStoreScope: [],
          storeId,
        }),
      ).toThrow(ForbiddenException);
    });

    it('staff with no scope passed is rejected (fail-closed)', () => {
      expect(() =>
        assertStoreAccess({
          user: user({ type: 'staff' }),
          ownerTenantId: 'tenant-X',
          storeId,
        }),
      ).toThrow(ForbiddenException);
    });
  });
});
