import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PasswordService } from '../../common/security/password.service';
import { SecurityLoggerService } from '../../common/security/security-logger.service';
import { SessionTokenService } from '../../common/security/session-token.service';
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthStore } from './staff-auth.store';
import { StaffAccount } from './entities/staff-account.entity';

/**
 * Unit-level coverage of the StaffAuth state machine. The store, password
 * service, session-token service, and security logger are stubbed; what we
 * exercise here is the policy: who is allowed to log in, when JWTs are
 * issued, what claims they carry, when refresh rotates, and what
 * validateStaff returns on each failure mode.
 */
describe('StaffAuthService', () => {
  const activeStaff: StaffAccount = {
    id: 'staff-1',
    tenantId: 'tenant-A',
    defaultStoreId: 'store-1',
    email: 'staff@store.example',
    fullName: 'Aylin Staff',
    phoneNumber: '+41 41 555 00 00',
    passwordHash: 'hash-good',
    staffType: 'cashier',
    employmentStatus: 'active',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  function makeService(staffStoreOverrides: Partial<StaffAuthStore> = {}) {
    const staffStore = {
      findByEmail: jest.fn().mockResolvedValue(activeStaff),
      findById: jest.fn().mockResolvedValue(activeStaff),
      listActiveStoreScope: jest.fn().mockResolvedValue(['store-1', 'store-2']),
      listMemberships: jest.fn(),
      touchLastLogin: jest.fn().mockResolvedValue(undefined),
      ...staffStoreOverrides,
    } as unknown as StaffAuthStore;

    const passwordService = {
      matches: jest.fn().mockResolvedValue(true),
    } as unknown as PasswordService;

    const sessionTokenService = {
      issueSession: jest.fn().mockResolvedValue({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
      }),
      rotateRefreshToken: jest.fn().mockResolvedValue({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
      }),
      revokeRefreshToken: jest.fn().mockResolvedValue(true),
      verifyRefreshToken: jest.fn().mockResolvedValue({
        sub: 'staff-1',
        type: 'staff',
        scope: 'refresh',
        sessionId: 'sess-1',
      }),
    } as unknown as SessionTokenService;

    const securityLogger = {
      logLoginFailure: jest.fn(),
      logLoginSuccess: jest.fn(),
      logRefreshFailure: jest.fn(),
      logRefreshSuccess: jest.fn(),
      logLogout: jest.fn(),
    } as unknown as SecurityLoggerService;

    const service = new StaffAuthService(
      staffStore,
      passwordService,
      sessionTokenService,
      securityLogger,
    );
    return { service, staffStore, passwordService, sessionTokenService, securityLogger };
  }

  describe('login', () => {
    it('issues a staff-typed session with storeScope from memberships', async () => {
      const { service, sessionTokenService } = makeService();
      const result = await service.login(
        { email: 'staff@store.example', password: 'StaffPass123' },
        {},
      );
      expect(result.accessToken).toBe('access-1');
      expect(result.staff.tenantId).toBe('tenant-A');
      expect(result.staff.storeScope).toEqual(['store-1', 'store-2']);
      expect(sessionTokenService.issueSession).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'staff',
          claims: expect.objectContaining({
            tenantId: 'tenant-A',
            storeScope: ['store-1', 'store-2'],
          }),
        }),
      );
    });

    it('rejects when email is not found', async () => {
      const { service } = makeService({
        findByEmail: jest.fn().mockResolvedValue(null),
      } as Partial<StaffAuthStore>);
      await expect(
        service.login({ email: 'nope@example', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when account isActive=false', async () => {
      const { service } = makeService({
        findByEmail: jest.fn().mockResolvedValue({ ...activeStaff, isActive: false }),
      } as Partial<StaffAuthStore>);
      await expect(
        service.login({ email: 'staff@store.example', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when employmentStatus is invited (invite pending)', async () => {
      const { service } = makeService({
        findByEmail: jest
          .fn()
          .mockResolvedValue({ ...activeStaff, employmentStatus: 'invited' }),
      } as Partial<StaffAuthStore>);
      await expect(
        service.login({ email: 'staff@store.example', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when employmentStatus is suspended', async () => {
      const { service } = makeService({
        findByEmail: jest
          .fn()
          .mockResolvedValue({ ...activeStaff, employmentStatus: 'suspended' }),
      } as Partial<StaffAuthStore>);
      await expect(
        service.login({ email: 'staff@store.example', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when passwordHash is null (invite pending, no password set)', async () => {
      const { service } = makeService({
        findByEmail: jest
          .fn()
          .mockResolvedValue({ ...activeStaff, passwordHash: null }),
      } as Partial<StaffAuthStore>);
      await expect(
        service.login({ email: 'staff@store.example', password: 'x' }, {}),
      ).rejects.toThrow(/set a password before logging in/);
    });

    it('rejects when passwordHash is empty string', async () => {
      const { service } = makeService({
        findByEmail: jest
          .fn()
          .mockResolvedValue({ ...activeStaff, passwordHash: '' }),
      } as Partial<StaffAuthStore>);
      await expect(
        service.login({ email: 'staff@store.example', password: 'x' }, {}),
      ).rejects.toThrow(/set a password before logging in/);
    });

    it('rejects when staff has no active membership', async () => {
      const { service } = makeService({
        listActiveStoreScope: jest.fn().mockResolvedValue([]),
      } as Partial<StaffAuthStore>);
      await expect(
        service.login({ email: 'staff@store.example', password: 'StaffPass123' }, {}),
      ).rejects.toThrow(/no active store assignment/);
    });

    it('rejects when password does not match', async () => {
      const { service, passwordService } = makeService();
      (passwordService.matches as jest.Mock).mockResolvedValueOnce(false);
      await expect(
        service.login({ email: 'staff@store.example', password: 'wrong' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates a staff refresh into a fresh access token + storeScope', async () => {
      const { service, sessionTokenService } = makeService();
      const result = await service.refresh('refresh-1', {});
      expect(result.accessToken).toBe('access-2');
      expect(sessionTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'refresh-1',
        expect.objectContaining({
          type: 'staff',
          claims: expect.objectContaining({ tenantId: 'tenant-A' }),
        }),
      );
    });

    it('rejects refresh when the staff account is inactive', async () => {
      const { service } = makeService({
        findById: jest.fn().mockResolvedValue({ ...activeStaff, isActive: false }),
      } as Partial<StaffAuthStore>);
      await expect(service.refresh('refresh-1', {})).rejects.toThrow(UnauthorizedException);
    });

    it('rejects refresh when active membership has been revoked', async () => {
      const { service } = makeService({
        listActiveStoreScope: jest.fn().mockResolvedValue([]),
      } as Partial<StaffAuthStore>);
      await expect(service.refresh('refresh-1', {})).rejects.toThrow(/no active store assignment/);
    });
  });

  describe('validateStaff', () => {
    it('returns the live session view', async () => {
      const { service } = makeService();
      const result = await service.validateStaff('staff-1');
      expect(result?.account.id).toBe('staff-1');
      expect(result?.storeScope).toEqual(['store-1', 'store-2']);
    });

    it('returns null when the account is missing', async () => {
      const { service } = makeService({
        findById: jest.fn().mockResolvedValue(null),
      } as Partial<StaffAuthStore>);
      expect(await service.validateStaff('staff-1')).toBeNull();
    });

    it('returns null when the account is inactive (no token use possible)', async () => {
      const { service } = makeService({
        findById: jest.fn().mockResolvedValue({ ...activeStaff, isActive: false }),
      } as Partial<StaffAuthStore>);
      expect(await service.validateStaff('staff-1')).toBeNull();
    });

    it('returns null when active store scope is empty (membership revoked)', async () => {
      const { service } = makeService({
        listActiveStoreScope: jest.fn().mockResolvedValue([]),
      } as Partial<StaffAuthStore>);
      expect(await service.validateStaff('staff-1')).toBeNull();
    });
  });

  describe('getProfile', () => {
    it('returns the public projection (never exposes passwordHash)', async () => {
      const { service } = makeService();
      const profile = await service.getProfile('staff-1');
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile.email).toBe('staff@store.example');
      expect(profile.storeScope).toEqual(['store-1', 'store-2']);
    });

    it('throws when the staff is not found', async () => {
      const { service } = makeService({
        findById: jest.fn().mockResolvedValue(null),
      } as Partial<StaffAuthStore>);
      await expect(service.getProfile('staff-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('logout', () => {
    it('revokes the refresh session', async () => {
      const { service, sessionTokenService } = makeService();
      const result = await service.logout('refresh-1', 'staff-1', {});
      expect(result.success).toBe(true);
      expect(sessionTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'refresh-1',
        'staff',
      );
    });
  });
});
