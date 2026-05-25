import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { TenantAccount } from './entities/tenant-account.entity';
import {
  DeliveryModel,
  TenantBusiness,
  TenantOnboardingStatus,
  TenantType,
  TenantVerificationStatus,
} from './entities/tenant-business.entity';
import { TenantStatusEventsService } from './tenant-status-events.service';
import { toTenantStatus } from './tenant-status';

/**
 * Input for creating a tenant: identity fields + business profile fields.
 * The store splits this into two rows (TenantAccount + TenantBusiness) and
 * also creates the OWNER TenantMembership row, all in one transaction.
 */
export interface NewTenantAccountInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  companyName: string;
  companyAddress: string;
  tenantType: TenantType;
  deliveryModel: DeliveryModel;
  verificationStatus: TenantVerificationStatus;
  onboardingStatus: TenantOnboardingStatus;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
}

/**
 * Joined view used by callers that need both halves of the tenant. Public API
 * responses are projected from this view (see TenantsService.toPublicAccount)
 * so the wire shape stays unchanged across the MR-ARCH-02 split.
 */
export interface TenantAccountView {
  account: TenantAccount;
  business: TenantBusiness;
}

@Injectable()
export class TenantAccountsStore {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly statusEvents: TenantStatusEventsService,
  ) {}

  async create(input: NewTenantAccountInput): Promise<TenantAccountView> {
    const now = new Date();
    const accountId = randomUUID();
    const businessId = randomUUID();

    const account: TenantAccount = {
      id: accountId,
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
      isActive: input.isActive,
      isVerified: input.isVerified,
      lastLoginAt: input.lastLoginAt,
      createdAt: now,
      updatedAt: now,
    };

    const business: TenantBusiness = {
      id: businessId,
      tenantAccountId: accountId,
      companyName: input.companyName,
      companyAddress: input.companyAddress,
      tenantType: input.tenantType,
      deliveryModel: input.deliveryModel,
      verificationStatus: input.verificationStatus,
      onboardingStatus: input.onboardingStatus,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `INSERT INTO "TenantAccount" (
            "id", "email", "passwordHash", "firstName", "lastName", "phoneNumber",
            "isActive", "isVerified", "lastLoginAt", "createdAt", "updatedAt"
          ) VALUES (
            $id, $email, $passwordHash, $firstName, $lastName, $phoneNumber,
            $isActive, $isVerified, $lastLoginAt, $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: account.id,
          $email: account.email,
          $passwordHash: account.passwordHash,
          $firstName: account.firstName,
          $lastName: account.lastName,
          $phoneNumber: account.phoneNumber,
          $isActive: account.isActive,
          $isVerified: account.isVerified,
          $lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
          $createdAt: account.createdAt.toISOString(),
          $updatedAt: account.updatedAt.toISOString(),
        });

      await this.databaseService
        .prepare(
          `INSERT INTO "TenantBusiness" (
            "id", "tenantAccountId", "companyName", "companyAddress",
            "tenantType", "deliveryModel", "verificationStatus", "onboardingStatus",
            "createdAt", "updatedAt"
          ) VALUES (
            $id, $tenantAccountId, $companyName, $companyAddress,
            $tenantType, $deliveryModel, $verificationStatus, $onboardingStatus,
            $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: business.id,
          $tenantAccountId: business.tenantAccountId,
          $companyName: business.companyName,
          $companyAddress: business.companyAddress,
          $tenantType: business.tenantType,
          $deliveryModel: business.deliveryModel,
          $verificationStatus: business.verificationStatus,
          $onboardingStatus: business.onboardingStatus,
          $createdAt: business.createdAt.toISOString(),
          $updatedAt: business.updatedAt.toISOString(),
        });

      // Membership row makes the binding explicit. MVP signups are single-owner.
      await this.databaseService
        .prepare(
          `INSERT INTO "TenantMembership" (
            "id", "tenantAccountId", "tenantBusinessId", "role", "status",
            "createdAt", "updatedAt"
          ) VALUES (
            $id, $tenantAccountId, $tenantBusinessId, 'owner', 'active',
            $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: randomUUID(),
          $tenantAccountId: account.id,
          $tenantBusinessId: business.id,
          $createdAt: account.createdAt.toISOString(),
          $updatedAt: account.updatedAt.toISOString(),
        });
    });

    return { account, business };
  }

  async findById(id: string): Promise<TenantAccountView | null> {
    return this.findJoined(`a."id" = $key`, { $key: id });
  }

  async findByEmail(email: string): Promise<TenantAccountView | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.findJoined(`a."email" = $key`, { $key: normalizedEmail });
  }

  async touchLastLogin(id: string): Promise<TenantAccountView> {
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "TenantAccount"
         SET "lastLoginAt" = $lastLoginAt, "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: id,
        $lastLoginAt: now,
        $updatedAt: now,
      });

    const view = await this.findById(id);
    if (!view) {
      throw new Error(`Tenant account ${id} not found after update.`);
    }
    return view;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<TenantAccountView> {
    const updatedAt = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "TenantAccount"
         SET "passwordHash" = $passwordHash, "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: id,
        $passwordHash: passwordHash,
        $updatedAt: updatedAt,
      });

    const view = await this.findById(id);
    if (!view) {
      throw new Error(`Tenant account ${id} not found after password update.`);
    }
    return view;
  }

  /**
   * Updates the business-profile compliance flags (onboarding +
   * verification status), and the identity-side isActive / isVerified
   * mirrors when those are passed. The status pub/sub fires when
   * `onboardingStatus` actually changes.
   */
  async updateComplianceStatus(
    id: string,
    input: {
      onboardingStatus: TenantOnboardingStatus;
      verificationStatus?: TenantVerificationStatus;
      isActive?: boolean;
      isVerified?: boolean;
    },
  ): Promise<TenantAccountView> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Tenant account ${id} not found.`);
    }

    const updatedAt = new Date().toISOString();

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `UPDATE "TenantBusiness"
           SET "onboardingStatus" = $onboardingStatus,
               "verificationStatus" = $verificationStatus,
               "updatedAt" = $updatedAt
           WHERE "tenantAccountId" = $id`,
        )
        .run({
          $id: id,
          $onboardingStatus: input.onboardingStatus,
          $verificationStatus: input.verificationStatus ?? existing.business.verificationStatus,
          $updatedAt: updatedAt,
        });

      if (input.isActive !== undefined || input.isVerified !== undefined) {
        await this.databaseService
          .prepare(
            `UPDATE "TenantAccount"
             SET "isActive" = $isActive,
                 "isVerified" = $isVerified,
                 "updatedAt" = $updatedAt
             WHERE "id" = $id`,
          )
          .run({
            $id: id,
            $isActive: input.isActive ?? existing.account.isActive,
            $isVerified: input.isVerified ?? existing.account.isVerified,
            $updatedAt: updatedAt,
          });
      }
    });

    const view = await this.findById(id);
    if (!view) {
      throw new Error(`Tenant account ${id} not found after compliance update.`);
    }

    if (view.business.onboardingStatus !== existing.business.onboardingStatus) {
      this.statusEvents.emit({
        tenantId: view.account.id,
        status: toTenantStatus(view.business.onboardingStatus),
        onboardingStatus: view.business.onboardingStatus,
      });
    }

    return view;
  }

  private async findJoined(
    whereClause: string,
    params: Record<string, unknown>,
  ): Promise<TenantAccountView | null> {
    const row = (await this.databaseService
      .prepare(
        `SELECT
           a."id" AS "accountId",
           a."email", a."passwordHash", a."firstName", a."lastName", a."phoneNumber",
           a."isActive", a."isVerified", a."lastLoginAt",
           a."createdAt" AS "accountCreatedAt", a."updatedAt" AS "accountUpdatedAt",
           b."id" AS "businessId",
           b."companyName", b."companyAddress", b."tenantType", b."deliveryModel",
           b."verificationStatus", b."onboardingStatus",
           b."createdAt" AS "businessCreatedAt", b."updatedAt" AS "businessUpdatedAt"
         FROM "TenantAccount" a
         INNER JOIN "TenantBusiness" b ON b."tenantAccountId" = a."id"
         WHERE ${whereClause}`,
      )
      .get(params)) as TenantJoinedRow | undefined;

    if (!row) {
      return null;
    }

    const account: TenantAccount = {
      id: row.accountId,
      email: row.email,
      passwordHash: row.passwordHash,
      firstName: row.firstName,
      lastName: row.lastName,
      phoneNumber: row.phoneNumber,
      isActive: Boolean(row.isActive),
      isVerified: Boolean(row.isVerified),
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
      createdAt: new Date(row.accountCreatedAt),
      updatedAt: new Date(row.accountUpdatedAt),
    };

    const business: TenantBusiness = {
      id: row.businessId,
      tenantAccountId: row.accountId,
      companyName: row.companyName,
      companyAddress: row.companyAddress,
      tenantType: row.tenantType as TenantType,
      deliveryModel: row.deliveryModel as DeliveryModel,
      verificationStatus: row.verificationStatus as TenantVerificationStatus,
      onboardingStatus: row.onboardingStatus as TenantOnboardingStatus,
      createdAt: new Date(row.businessCreatedAt),
      updatedAt: new Date(row.businessUpdatedAt),
    };

    return { account, business };
  }
}

interface TenantJoinedRow {
  accountId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: string | null;
  accountCreatedAt: string;
  accountUpdatedAt: string;
  businessId: string;
  companyName: string;
  companyAddress: string;
  tenantType: string;
  deliveryModel: string;
  verificationStatus: string;
  onboardingStatus: string;
  businessCreatedAt: string;
  businessUpdatedAt: string;
}
