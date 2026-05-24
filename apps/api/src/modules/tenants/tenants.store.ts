import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { TenantAccount } from './entities/tenant-account.entity';
import { TenantStatusEventsService } from './tenant-status-events.service';
import { toTenantStatus } from './tenant-status';

type NewTenantAccount = Omit<TenantAccount, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable()
export class TenantAccountsStore {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly statusEvents: TenantStatusEventsService,
  ) {}

  async create(input: NewTenantAccount): Promise<TenantAccount> {
    const now = new Date();
    const account: TenantAccount = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "TenantAccount" (
          "id", "email", "passwordHash", "firstName", "lastName", "phoneNumber",
          "companyName", "companyAddress", "tenantType", "deliveryModel",
          "verificationStatus", "onboardingStatus", "isActive", "isVerified",
          "lastLoginAt", "createdAt", "updatedAt"
        ) VALUES (
          $id, $email, $passwordHash, $firstName, $lastName, $phoneNumber,
          $companyName, $companyAddress, $tenantType, $deliveryModel,
          $verificationStatus, $onboardingStatus, $isActive, $isVerified,
          $lastLoginAt, $createdAt, $updatedAt
        )`,
      )
      .run(this.toRow(account));

    return account;
  }

  async findById(id: string): Promise<TenantAccount | null> {
    const account = await this.databaseService
      .prepare(`SELECT * FROM "TenantAccount" WHERE "id" = $id`)
      .get({ $id: id }) as TenantAccountRow | undefined;

    return account ? this.mapAccount(account) : null;
  }

  async findByEmail(email: string): Promise<TenantAccount | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const account = await this.databaseService
      .prepare(`SELECT * FROM "TenantAccount" WHERE "email" = $email`)
      .get({ $email: normalizedEmail }) as TenantAccountRow | undefined;

    return account ? this.mapAccount(account) : null;
  }

  async touchLastLogin(id: string): Promise<TenantAccount> {
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

    const account = await this.findById(id);
    if (!account) {
      throw new Error(`Tenant account ${id} not found after update.`);
    }

    return account;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<TenantAccount> {
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

    const account = await this.findById(id);
    if (!account) {
      throw new Error(`Tenant account ${id} not found after password update.`);
    }

    return account;
  }

  async updateComplianceStatus(
    id: string,
    input: {
      onboardingStatus: TenantAccount['onboardingStatus'];
      verificationStatus?: TenantAccount['verificationStatus'];
      isActive?: boolean;
      isVerified?: boolean;
    },
  ): Promise<TenantAccount> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Tenant account ${id} not found.`);
    }

    const updatedAt = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "TenantAccount"
         SET "onboardingStatus" = $onboardingStatus,
             "verificationStatus" = $verificationStatus,
             "isActive" = $isActive,
             "isVerified" = $isVerified,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: id,
        $onboardingStatus: input.onboardingStatus,
        $verificationStatus: input.verificationStatus ?? existing.verificationStatus,
        $isActive: input.isActive ?? existing.isActive,
        $isVerified: input.isVerified ?? existing.isVerified,
        $updatedAt: updatedAt,
      });

    const account = await this.findById(id);
    if (!account) {
      throw new Error(`Tenant account ${id} not found after compliance update.`);
    }

    if (account.onboardingStatus !== existing.onboardingStatus) {
      this.statusEvents.emit({
        tenantId: account.id,
        status: toTenantStatus(account.onboardingStatus),
        onboardingStatus: account.onboardingStatus,
      });
    }

    return account;
  }

  private mapAccount(account: TenantAccountRow): TenantAccount {
    return {
      id: account.id,
      email: account.email,
      passwordHash: account.passwordHash,
      firstName: account.firstName,
      lastName: account.lastName,
      phoneNumber: account.phoneNumber,
      companyName: account.companyName,
      companyAddress: account.companyAddress,
      tenantType: account.tenantType as TenantAccount['tenantType'],
      deliveryModel: account.deliveryModel as TenantAccount['deliveryModel'],
      verificationStatus:
        account.verificationStatus as TenantAccount['verificationStatus'],
      onboardingStatus: account.onboardingStatus as TenantAccount['onboardingStatus'],
      isActive: Boolean(account.isActive),
      isVerified: Boolean(account.isVerified),
      lastLoginAt: account.lastLoginAt ? new Date(account.lastLoginAt) : null,
      createdAt: new Date(account.createdAt),
      updatedAt: new Date(account.updatedAt),
    };
  }

  private toRow(account: TenantAccount) {
    return {
      $id: account.id,
      $email: account.email,
      $passwordHash: account.passwordHash,
      $firstName: account.firstName,
      $lastName: account.lastName,
      $phoneNumber: account.phoneNumber,
      $companyName: account.companyName,
      $companyAddress: account.companyAddress,
      $tenantType: account.tenantType,
      $deliveryModel: account.deliveryModel,
      $verificationStatus: account.verificationStatus,
      $onboardingStatus: account.onboardingStatus,
      $isActive: account.isActive,
      $isVerified: account.isVerified,
      $lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
      $createdAt: account.createdAt.toISOString(),
      $updatedAt: account.updatedAt.toISOString(),
    };
  }
}

interface TenantAccountRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  companyName: string;
  companyAddress: string;
  tenantType: string;
  deliveryModel: string;
  verificationStatus: string;
  onboardingStatus: string;
  isActive: number;
  isVerified: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
