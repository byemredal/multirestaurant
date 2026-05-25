import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import {
  StaffAccount,
  StaffEmploymentStatus,
  StaffMembership,
  StaffMembershipRole,
  StaffMembershipStatus,
  StaffType,
} from './entities/staff-account.entity';

export interface CreateStaffInput {
  tenantId: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  staffType: StaffType;
  defaultStoreId: string | null;
}

export interface UpdateStaffInput {
  fullName?: string;
  phoneNumber?: string | null;
  staffType?: StaffType;
  defaultStoreId?: string | null;
  employmentStatus?: StaffEmploymentStatus;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface StoreMembershipAssignment {
  storeId: string;
  role: StaffMembershipRole;
}

interface StaffAccountRow {
  id: string;
  tenantId: string;
  defaultStoreId: string | null;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  passwordHash: string | null;
  staffType: string;
  employmentStatus: string;
  isActive: boolean | number;
  isVerified: boolean | number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffMembershipRow {
  id: string;
  staffAccountId: string;
  tenantId: string;
  storeId: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class StaffAuthStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByEmail(email: string): Promise<StaffAccount | null> {
    const normalized = email.trim().toLowerCase();
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "StaffAccount" WHERE LOWER("email") = $email`)
      .get({ $email: normalized })) as StaffAccountRow | undefined;
    return row ? this.mapAccount(row) : null;
  }

  async findById(id: string): Promise<StaffAccount | null> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "StaffAccount" WHERE "id" = $id`)
      .get({ $id: id })) as StaffAccountRow | undefined;
    return row ? this.mapAccount(row) : null;
  }

  /**
   * Loads only the *active* store IDs the staff is currently bound to.
   * Suspended memberships are ignored on purpose: the JWT scope must
   * reflect what the staff can act on RIGHT NOW. This is what
   * AccessTokenGuard puts on the AuthenticatedUser.staffStoreScope.
   */
  async listActiveStoreScope(staffAccountId: string): Promise<string[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT "storeId" FROM "StaffMembership"
         WHERE "staffAccountId" = $staffAccountId AND "status" = 'active'`,
      )
      .all({ $staffAccountId: staffAccountId })) as Array<{ storeId: string }>;
    return rows.map((row) => row.storeId);
  }

  async listMemberships(staffAccountId: string): Promise<StaffMembership[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "StaffMembership"
         WHERE "staffAccountId" = $staffAccountId
         ORDER BY "createdAt" ASC`,
      )
      .all({ $staffAccountId: staffAccountId })) as StaffMembershipRow[];
    return rows.map((row) => this.mapMembership(row));
  }

  async touchLastLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "StaffAccount"
         SET "lastLoginAt" = $now, "updatedAt" = $now
         WHERE "id" = $id`,
      )
      .run({ $id: id, $now: now });
  }

  /**
   * Creates an `invited` StaffAccount with `passwordHash = NULL`. The caller
   * is responsible for issuing a StaffInviteToken in the same transaction —
   * see TenantStaffService.invite.
   */
  async createInvited(input: CreateStaffInput): Promise<StaffAccount> {
    const id = randomUUID();
    const now = new Date();
    await this.databaseService
      .prepare(
        `INSERT INTO "StaffAccount" (
          "id", "tenantId", "defaultStoreId", "email", "fullName", "phoneNumber",
          "passwordHash", "staffType", "employmentStatus",
          "isActive", "isVerified", "lastLoginAt", "createdAt", "updatedAt"
        ) VALUES (
          $id, $tenantId, $defaultStoreId, $email, $fullName, $phoneNumber,
          NULL, $staffType, 'invited',
          TRUE, FALSE, NULL, $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: id,
        $tenantId: input.tenantId,
        $defaultStoreId: input.defaultStoreId,
        $email: input.email.trim().toLowerCase(),
        $fullName: input.fullName,
        $phoneNumber: input.phoneNumber,
        $staffType: input.staffType,
        $createdAt: now.toISOString(),
        $updatedAt: now.toISOString(),
      });

    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Staff account ${id} not found after insert.`);
    }
    return created;
  }

  async listForTenant(tenantId: string): Promise<StaffAccount[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "StaffAccount"
         WHERE "tenantId" = $tenantId
         ORDER BY "createdAt" DESC`,
      )
      .all({ $tenantId: tenantId })) as StaffAccountRow[];
    return rows.map((row) => this.mapAccount(row));
  }

  async update(staffId: string, input: UpdateStaffInput): Promise<StaffAccount> {
    const existing = await this.findById(staffId);
    if (!existing) {
      throw new Error(`Staff account ${staffId} not found.`);
    }

    const next = {
      fullName: input.fullName ?? existing.fullName,
      phoneNumber:
        input.phoneNumber === undefined ? existing.phoneNumber : input.phoneNumber,
      staffType: input.staffType ?? existing.staffType,
      defaultStoreId:
        input.defaultStoreId === undefined
          ? existing.defaultStoreId
          : input.defaultStoreId,
      employmentStatus: input.employmentStatus ?? existing.employmentStatus,
      isActive: input.isActive ?? existing.isActive,
      isVerified: input.isVerified ?? existing.isVerified,
    };

    await this.databaseService
      .prepare(
        `UPDATE "StaffAccount"
         SET "fullName" = $fullName,
             "phoneNumber" = $phoneNumber,
             "staffType" = $staffType,
             "defaultStoreId" = $defaultStoreId,
             "employmentStatus" = $employmentStatus,
             "isActive" = $isActive,
             "isVerified" = $isVerified,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: staffId,
        $fullName: next.fullName,
        $phoneNumber: next.phoneNumber,
        $staffType: next.staffType,
        $defaultStoreId: next.defaultStoreId,
        $employmentStatus: next.employmentStatus,
        $isActive: next.isActive,
        $isVerified: next.isVerified,
        $updatedAt: new Date().toISOString(),
      });

    const updated = await this.findById(staffId);
    if (!updated) {
      throw new Error(`Staff account ${staffId} not found after update.`);
    }
    return updated;
  }

  /**
   * Replace the staff's set of memberships with the new list. Cross-tenant
   * assignment is the caller's responsibility — TenantStaffService validates
   * that every storeId belongs to the right tenant BEFORE calling this.
   * The reconciliation is in one transaction so we never leave the staff
   * with partial scope.
   */
  async replaceMemberships(
    staffAccountId: string,
    tenantId: string,
    assignments: StoreMembershipAssignment[],
  ): Promise<StaffMembership[]> {
    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `DELETE FROM "StaffMembership" WHERE "staffAccountId" = $staffAccountId`,
        )
        .run({ $staffAccountId: staffAccountId });

      const now = new Date().toISOString();
      for (const assignment of assignments) {
        await this.databaseService
          .prepare(
            `INSERT INTO "StaffMembership" (
              "id", "staffAccountId", "tenantId", "storeId", "role", "status",
              "createdAt", "updatedAt"
            ) VALUES (
              $id, $staffAccountId, $tenantId, $storeId, $role, 'active',
              $now, $now
            )`,
          )
          .run({
            $id: randomUUID(),
            $staffAccountId: staffAccountId,
            $tenantId: tenantId,
            $storeId: assignment.storeId,
            $role: assignment.role,
            $now: now,
          });
      }
    });

    return this.listMemberships(staffAccountId);
  }

  async setPasswordHash(staffId: string, passwordHash: string): Promise<void> {
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "StaffAccount"
         SET "passwordHash" = $passwordHash,
             "employmentStatus" = 'active',
             "isVerified" = TRUE,
             "updatedAt" = $now
         WHERE "id" = $id`,
      )
      .run({
        $id: staffId,
        $passwordHash: passwordHash,
        $now: now,
      });
  }

  private mapAccount(row: StaffAccountRow): StaffAccount {
    return {
      id: row.id,
      tenantId: row.tenantId,
      defaultStoreId: row.defaultStoreId,
      email: row.email,
      fullName: row.fullName,
      phoneNumber: row.phoneNumber,
      passwordHash: row.passwordHash,
      staffType: row.staffType as StaffType,
      employmentStatus: row.employmentStatus as StaffEmploymentStatus,
      isActive: Boolean(row.isActive),
      isVerified: Boolean(row.isVerified),
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapMembership(row: StaffMembershipRow): StaffMembership {
    return {
      id: row.id,
      staffAccountId: row.staffAccountId,
      tenantId: row.tenantId,
      storeId: row.storeId,
      role: row.role as StaffMembershipRole,
      status: row.status as StaffMembershipStatus,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
