import { AdminAuthService } from './admin-auth.service';

/**
 * MR-DB-HARDENING-01 Slice 6 — locks the canonical admin role source.
 * The JWT role claim must come from AdminAccount.role. AdminMembership.role is
 * not an authorization source and is never consulted (the auth service has no
 * membership dependency). See docs/architecture/admin-role-source-of-truth.md.
 */
describe('AdminAuthService canonical role source', () => {
  function build(accountRole: string) {
    const account = {
      id: 'admin-1',
      email: 'admin@example.io',
      passwordHash: 'hash',
      firstName: 'A',
      lastName: 'B',
      role: accountRole,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const adminUsersStore = {
      findByEmail: jest.fn().mockResolvedValue(account),
      touchLastLogin: jest.fn().mockResolvedValue(account),
      findById: jest.fn().mockResolvedValue(account),
    };
    const passwordService = { matches: jest.fn().mockResolvedValue(true) };
    const issueSession = jest
      .fn()
      .mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
    const sessionTokenService = { issueSession };
    const securityLogger = {
      logLoginSuccess: jest.fn(),
      logLoginFailure: jest.fn(),
    };
    const service = new AdminAuthService(
      adminUsersStore as any,
      passwordService as any,
      sessionTokenService as any,
      securityLogger as any,
    );
    return { service, issueSession };
  }

  it('issues the JWT role claim from AdminAccount.role', async () => {
    const { service, issueSession } = build('super_admin');

    await service.login({ email: 'admin@example.io', password: 'pw' });

    expect(issueSession).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'admin',
        claims: { role: 'super_admin' },
      }),
    );
  });

  it('tracks AdminAccount.role verbatim (AdminMembership.role never overrides it)', async () => {
    // The service depends only on AdminUsersStore (the AdminAccount identity).
    // The claim follows that value — no AdminMembership lookup exists to override.
    const { service, issueSession } = build('review_admin');

    await service.login({ email: 'admin@example.io', password: 'pw' });

    expect(issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ claims: { role: 'review_admin' } }),
    );
  });
});
