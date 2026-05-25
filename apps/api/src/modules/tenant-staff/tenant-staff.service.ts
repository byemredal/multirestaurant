import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  StaffAccount,
  StaffMembership,
  StaffMembershipRole,
  StaffType,
} from '../staff-auth/entities/staff-account.entity';
import { StaffAuthStore, StoreMembershipAssignment } from '../staff-auth/staff-auth.store';
import { StaffInviteTokenStore } from '../staff-auth/staff-invite-token.store';
import {
  InviteStaffDto,
  StoreAssignmentDto,
  UpdateStaffDto,
} from './dto/invite-staff.dto';
import { TenantMembershipStore } from './tenant-membership.store';

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const STAFF_MANAGEMENT_ROLES = new Set(['owner', 'co_owner']);

@Injectable()
export class TenantStaffService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly staffAuthStore: StaffAuthStore,
    private readonly staffInviteTokenStore: StaffInviteTokenStore,
    private readonly tenantMembershipStore: TenantMembershipStore,
  ) {}

  async invite(tenantAccountId: string, dto: InviteStaffDto) {
    await this.assertStaffManagementRole(tenantAccountId);
    await this.assertStoresOwnedByTenant(
      tenantAccountId,
      this.collectStoreIds(dto),
    );

    const existing = await this.staffAuthStore.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Staff account already exists for this email.');
    }

    const staff = await this.staffAuthStore.createInvited({
      tenantId: tenantAccountId,
      email: dto.email,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber?.trim() ?? null,
      staffType: dto.staffType as StaffType,
      defaultStoreId: dto.defaultStoreId ?? null,
    });

    const memberships = await this.staffAuthStore.replaceMemberships(
      staff.id,
      tenantAccountId,
      this.toAssignments(dto.stores),
    );

    const { rawToken, token } = await this.staffInviteTokenStore.issueForStaff({
      staffAccountId: staff.id,
      createdByTenantAccountId: tenantAccountId,
      ttlMs: INVITE_TOKEN_TTL_MS,
    });

    return {
      staff: this.toPublicStaff(staff, memberships),
      invite: {
        // Raw token is returned exactly once. Surface it to the staff via
        // out-of-band channel (manual share / future email integration).
        token: rawToken,
        expiresAt: token.expiresAt,
        acceptUrl: `/staff/accept-invite?token=${encodeURIComponent(rawToken)}`,
      },
    };
  }

  async list(tenantAccountId: string) {
    await this.assertStaffManagementRole(tenantAccountId);
    const accounts = await this.staffAuthStore.listForTenant(tenantAccountId);
    const detailed = await Promise.all(
      accounts.map(async (account) => {
        const memberships = await this.staffAuthStore.listMemberships(account.id);
        return this.toPublicStaff(account, memberships);
      }),
    );
    return { staff: detailed };
  }

  async getOne(tenantAccountId: string, staffId: string) {
    await this.assertStaffManagementRole(tenantAccountId);
    const staff = await this.requireOwnStaff(tenantAccountId, staffId);
    const memberships = await this.staffAuthStore.listMemberships(staff.id);
    return this.toPublicStaff(staff, memberships);
  }

  async update(tenantAccountId: string, staffId: string, dto: UpdateStaffDto) {
    await this.assertStaffManagementRole(tenantAccountId);
    const staff = await this.requireOwnStaff(tenantAccountId, staffId);

    if (dto.defaultStoreId) {
      await this.assertStoresOwnedByTenant(tenantAccountId, [dto.defaultStoreId]);
    }
    if (dto.stores) {
      await this.assertStoresOwnedByTenant(
        tenantAccountId,
        dto.stores.map((s) => s.storeId),
      );
    }

    const updated = await this.staffAuthStore.update(staff.id, {
      fullName: dto.fullName,
      phoneNumber:
        dto.phoneNumber === undefined ? undefined : (dto.phoneNumber?.trim() ?? null),
      staffType: dto.staffType as StaffType | undefined,
      defaultStoreId:
        dto.defaultStoreId === undefined ? undefined : (dto.defaultStoreId ?? null),
    });

    let memberships = await this.staffAuthStore.listMemberships(updated.id);
    if (dto.stores) {
      memberships = await this.staffAuthStore.replaceMemberships(
        updated.id,
        tenantAccountId,
        this.toAssignments(dto.stores),
      );
    }
    return this.toPublicStaff(updated, memberships);
  }

  async deactivate(tenantAccountId: string, staffId: string) {
    await this.assertStaffManagementRole(tenantAccountId);
    const staff = await this.requireOwnStaff(tenantAccountId, staffId);

    const updated = await this.staffAuthStore.update(staff.id, {
      isActive: false,
      employmentStatus: 'suspended',
    });
    const memberships = await this.staffAuthStore.listMemberships(updated.id);
    return this.toPublicStaff(updated, memberships);
  }

  async resendInvite(tenantAccountId: string, staffId: string) {
    await this.assertStaffManagementRole(tenantAccountId);
    const staff = await this.requireOwnStaff(tenantAccountId, staffId);

    if (staff.passwordHash && staff.passwordHash !== '') {
      throw new ConflictException(
        'Staff has already accepted the invite — no new invite token is needed.',
      );
    }

    const { rawToken, token } = await this.staffInviteTokenStore.issueForStaff({
      staffAccountId: staff.id,
      createdByTenantAccountId: tenantAccountId,
      ttlMs: INVITE_TOKEN_TTL_MS,
    });
    return {
      invite: {
        token: rawToken,
        expiresAt: token.expiresAt,
        acceptUrl: `/staff/accept-invite?token=${encodeURIComponent(rawToken)}`,
      },
    };
  }

  /**
   * Throws ForbiddenException unless the caller carries an active
   * TenantMembership whose role is owner or co_owner. Staff and customer
   * subjects never reach here because the controller is @AuthTypes('tenant').
   */
  private async assertStaffManagementRole(tenantAccountId: string): Promise<void> {
    const memberships = await this.tenantMembershipStore.listForTenantAccount(
      tenantAccountId,
    );
    const allowed = memberships.some(
      (membership) =>
        membership.status === 'active' &&
        STAFF_MANAGEMENT_ROLES.has(membership.role),
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only tenant owners or co-owners may manage staff.',
      );
    }
  }

  /**
   * Every storeId in `storeIds` must be owned by `tenantAccountId`. A single
   * unrelated store rejects the entire request — partial cross-tenant
   * leakage is the exact failure mode this check exists to stop.
   */
  private async assertStoresOwnedByTenant(
    tenantAccountId: string,
    storeIds: string[],
  ): Promise<void> {
    const unique = Array.from(new Set(storeIds.filter(Boolean)));
    if (unique.length === 0) {
      return;
    }
    const rows = (await this.databaseService
      .prepare(
        `SELECT "id" FROM "Store"
         WHERE "id" = ANY($ids::uuid[]) AND "ownerTenantId" = $tenantAccountId`,
      )
      .all({
        $ids: unique,
        $tenantAccountId: tenantAccountId,
      })) as Array<{ id: string }>;

    if (rows.length !== unique.length) {
      throw new ForbiddenException(
        'One or more stores do not belong to this tenant.',
      );
    }
  }

  private async requireOwnStaff(
    tenantAccountId: string,
    staffId: string,
  ): Promise<StaffAccount> {
    const staff = await this.staffAuthStore.findById(staffId);
    if (!staff || staff.tenantId !== tenantAccountId) {
      throw new NotFoundException('Staff account could not be found.');
    }
    return staff;
  }

  private collectStoreIds(dto: InviteStaffDto): string[] {
    const ids = dto.stores.map((s) => s.storeId);
    if (dto.defaultStoreId) {
      ids.push(dto.defaultStoreId);
    }
    return ids;
  }

  private toAssignments(items: StoreAssignmentDto[]): StoreMembershipAssignment[] {
    return items.map((item) => ({
      storeId: item.storeId,
      role: item.role as StaffMembershipRole,
    }));
  }

  /**
   * Public projection for tenant-side responses. Never returns passwordHash,
   * token hashes, or any other secret-bearing field. The `hasPassword`
   * boolean is what consumers use to distinguish accepted vs invite-pending
   * accounts.
   */
  private toPublicStaff(staff: StaffAccount, memberships: StaffMembership[]) {
    return {
      id: staff.id,
      tenantId: staff.tenantId,
      email: staff.email,
      fullName: staff.fullName,
      phoneNumber: staff.phoneNumber,
      staffType: staff.staffType,
      employmentStatus: staff.employmentStatus,
      isActive: staff.isActive,
      isVerified: staff.isVerified,
      defaultStoreId: staff.defaultStoreId,
      lastLoginAt: staff.lastLoginAt,
      hasPassword: Boolean(staff.passwordHash && staff.passwordHash !== ''),
      memberships: memberships.map((membership) => ({
        id: membership.id,
        storeId: membership.storeId,
        role: membership.role,
        status: membership.status,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      })),
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }
}

