import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  StaffAccount,
  StaffMembership,
} from '../staff-auth/entities/staff-account.entity';
import { StaffAuthStore } from '../staff-auth/staff-auth.store';
import { StaffInviteTokenStore } from '../staff-auth/staff-invite-token.store';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { TenantMembershipStore } from './tenant-membership.store';
import { TenantStaffService } from './tenant-staff.service';

/**
 * Pure-unit coverage of the tenant staff management policy. The DB,
 * StaffAuthStore, invite-token store, and TenantMembershipStore are
 * stubbed; what we exercise here is the authorization matrix and the
 * input-validation rules.
 */
describe('TenantStaffService', () => {
  const tenantId = 'tenant-A';
  const ownerMembership = {
    id: 'mem-1',
    tenantAccountId: tenantId,
    tenantBusinessId: 'biz-1',
    role: 'owner' as const,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const invitedStaff: StaffAccount = {
    id: 'staff-1',
    tenantId,
    defaultStoreId: null,
    email: 'new@store.example',
    fullName: 'Hire One',
    phoneNumber: null,
    passwordHash: null,
    staffType: 'cashier',
    employmentStatus: 'invited',
    isActive: true,
    isVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function makeService(over: {
    tenantMemberships?: Array<typeof ownerMembership>;
    storeOwnership?: 'all-mine' | 'foreign' | 'partial';
    findByEmail?: StaffAccount | null;
    findById?: StaffAccount | null;
  } = {}) {
    const tenantMemberships = over.tenantMemberships ?? [ownerMembership];
    const storeRows = (ids: string[]): Array<{ id: string }> => {
      if (over.storeOwnership === 'foreign') {
        return [];
      }
      if (over.storeOwnership === 'partial') {
        return ids.length > 0 ? [{ id: ids[0]! }] : [];
      }
      return ids.map((id) => ({ id }));
    };

    const databaseService = {
      prepare: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM "Store"')) {
          return {
            all: jest.fn().mockImplementation((params: Record<string, unknown>) =>
              Promise.resolve(storeRows((params.$ids as string[]) ?? [])),
            ),
            get: jest.fn(),
            run: jest.fn(),
          };
        }
        return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
      }),
    } as unknown as DatabaseService;

    const memberships: StaffMembership[] = [];
    const staffAuthStore = {
      findByEmail: jest.fn().mockResolvedValue(over.findByEmail ?? null),
      findById: jest
        .fn()
        .mockResolvedValue(over.findById === undefined ? invitedStaff : over.findById),
      createInvited: jest.fn().mockResolvedValue(invitedStaff),
      listForTenant: jest.fn().mockResolvedValue([invitedStaff]),
      listMemberships: jest.fn().mockResolvedValue(memberships),
      replaceMemberships: jest.fn().mockResolvedValue(memberships),
      update: jest.fn().mockResolvedValue(invitedStaff),
    } as unknown as StaffAuthStore;

    const inviteTokenStore = {
      issueForStaff: jest.fn().mockResolvedValue({
        rawToken: 'raw-secret',
        token: {
          id: 'token-1',
          staffAccountId: invitedStaff.id,
          tokenHash: 'h',
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
          createdByTenantAccountId: tenantId,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    } as unknown as StaffInviteTokenStore;

    const tenantMembershipStore = {
      listForTenantAccount: jest.fn().mockResolvedValue(tenantMemberships),
    } as unknown as TenantMembershipStore;

    const service = new TenantStaffService(
      databaseService,
      staffAuthStore,
      inviteTokenStore,
      tenantMembershipStore,
    );
    return { service, staffAuthStore, inviteTokenStore, tenantMembershipStore };
  }

  const inviteDto: InviteStaffDto = {
    email: 'new@store.example',
    fullName: 'Hire One',
    staffType: 'cashier',
    stores: [{ storeId: 'b0000000-0000-4000-8000-000000000001', role: 'cashier' }],
  };

  describe('invite', () => {
    it('creates staff + membership + returns raw token exactly once', async () => {
      const { service, staffAuthStore, inviteTokenStore } = makeService();
      const result = await service.invite(tenantId, inviteDto);
      expect(staffAuthStore.createInvited).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, email: 'new@store.example' }),
      );
      expect(staffAuthStore.replaceMemberships).toHaveBeenCalled();
      expect(inviteTokenStore.issueForStaff).toHaveBeenCalled();
      expect(result.invite.token).toBe('raw-secret');
      expect(result.invite.acceptUrl).toContain('raw-secret');
      // Public projection never leaks passwordHash.
      expect(result.staff).not.toHaveProperty('passwordHash');
    });

    it('rejects callers without an active owner/co_owner membership', async () => {
      const { service } = makeService({
        tenantMemberships: [
          { ...ownerMembership, role: 'manager' as never },
        ],
      });
      await expect(service.invite(tenantId, inviteDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects callers with a suspended owner membership', async () => {
      const { service } = makeService({
        tenantMemberships: [
          { ...ownerMembership, status: 'suspended' as never },
        ],
      });
      await expect(service.invite(tenantId, inviteDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects when a requested store belongs to a different tenant', async () => {
      const { service } = makeService({ storeOwnership: 'foreign' });
      await expect(service.invite(tenantId, inviteDto)).rejects.toThrow(
        /do not belong to this tenant/,
      );
    });

    it('rejects when only SOME of the requested stores belong to the tenant', async () => {
      const multiStoreDto: InviteStaffDto = {
        ...inviteDto,
        stores: [
          { storeId: 'b0000000-0000-4000-8000-000000000001', role: 'cashier' },
          { storeId: 'b0000000-0000-4000-8000-000000000002', role: 'cashier' },
        ],
      };
      const { service } = makeService({ storeOwnership: 'partial' });
      await expect(service.invite(tenantId, multiStoreDto)).rejects.toThrow(
        /do not belong to this tenant/,
      );
    });

    it('rejects re-inviting an email that already has a staff account', async () => {
      const { service } = makeService({ findByEmail: invitedStaff });
      await expect(service.invite(tenantId, inviteDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('list / getOne / update / deactivate', () => {
    it('list: returns sanitized staff (no passwordHash)', async () => {
      const { service } = makeService();
      const { staff } = await service.list(tenantId);
      expect(staff).toHaveLength(1);
      expect(staff[0]).not.toHaveProperty('passwordHash');
    });

    it('getOne: 404 when staff belongs to a different tenant', async () => {
      const { service } = makeService({
        findById: { ...invitedStaff, tenantId: 'tenant-OTHER' },
      });
      await expect(service.getOne(tenantId, invitedStaff.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('update: rejects cross-tenant defaultStoreId', async () => {
      const { service } = makeService({ storeOwnership: 'foreign' });
      await expect(
        service.update(tenantId, invitedStaff.id, {
          defaultStoreId: 'b0000000-0000-4000-8000-000000000002',
        }),
      ).rejects.toThrow(/do not belong to this tenant/);
    });

    it('deactivate: sets isActive=false + suspended', async () => {
      const { service, staffAuthStore } = makeService();
      await service.deactivate(tenantId, invitedStaff.id);
      expect(staffAuthStore.update).toHaveBeenCalledWith(
        invitedStaff.id,
        expect.objectContaining({ isActive: false, employmentStatus: 'suspended' }),
      );
    });
  });

  describe('resendInvite', () => {
    it('issues a new token when staff has no password yet', async () => {
      const { service, inviteTokenStore } = makeService();
      const result = await service.resendInvite(tenantId, invitedStaff.id);
      expect(inviteTokenStore.issueForStaff).toHaveBeenCalled();
      expect(result.invite.token).toBe('raw-secret');
    });

    it('rejects resend when the staff already accepted (has a password)', async () => {
      const { service } = makeService({
        findById: { ...invitedStaff, passwordHash: 'already-set' },
      });
      await expect(
        service.resendInvite(tenantId, invitedStaff.id),
      ).rejects.toThrow(ConflictException);
    });
  });
});
