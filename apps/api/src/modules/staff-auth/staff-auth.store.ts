import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  StaffAccount,
  StaffEmploymentStatus,
  StaffMembership,
  StaffMembershipRole,
  StaffMembershipStatus,
  StaffType,
} from './entities/staff-account.entity';

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
