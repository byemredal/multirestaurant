import { Reflector } from '@nestjs/core';
import { AdminTenantApplicationsController } from './admin-tenant-applications.controller';
import { ADMIN_ROLES_KEY } from '../../common/security/decorators/admin-roles.decorator';
import { AdminRole } from '../admin-auth/entities/admin-account.entity';

/**
 * Resend role policy MUST mirror the approve route. The brief explicitly
 * asked "resend role policy approve ile uyumlu mu?" — losing the symmetry
 * would let OPERATIONS_ADMIN issue a magic link that the same admin
 * couldn't have triggered via the approve flow.
 *
 * We assert via the reflector (instead of HTTP) so the test stays scoped to
 * the decorator metadata; the AdminRoleGuard already has its own coverage
 * for the guard semantics.
 */
describe('AdminTenantApplicationsController — admin role policy symmetry', () => {
  const reflector = new Reflector();

  function rolesOn(method: keyof AdminTenantApplicationsController): AdminRole[] {
    const handler = AdminTenantApplicationsController.prototype[method];
    const meta = reflector.get<AdminRole[] | undefined>(ADMIN_ROLES_KEY, handler);
    if (!meta) {
      throw new Error(
        `Handler ${String(method)} has no @AdminRoles metadata — guard would default-allow.`,
      );
    }
    return [...meta].sort();
  }

  it('resend uses the same role set as approve', () => {
    const approveRoles = rolesOn('approve');
    const resendRoles = rolesOn('resendPasswordSetup');
    expect(resendRoles).toEqual(approveRoles);
  });

  it('approve is locked to SUPER_ADMIN + REVIEW_ADMIN (sentinel — protects against accidental widening)', () => {
    const approveRoles = rolesOn('approve');
    expect(approveRoles).toEqual([AdminRole.REVIEW_ADMIN, AdminRole.SUPER_ADMIN].sort());
  });
});
