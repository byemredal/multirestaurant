import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CustomerAccount } from './entities/customer-account.entity';

type NewCustomerAccount = Omit<CustomerAccount, 'id' | 'createdAt' | 'updatedAt'>;
type SocialProvider = 'google' | 'facebook';

@Injectable()
export class CustomerAccountsStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: NewCustomerAccount): Promise<CustomerAccount> {
    const now = new Date();
    const account: CustomerAccount = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "CustomerAccount" (
          "id", "email", "firstName", "lastName", "passwordHash", "loginPreference",
          "phoneNumber", "birthDate", "isActive", "isVerified", "lastLoginAt",
          "createdAt", "updatedAt"
        ) VALUES (
          $id, $email, $firstName, $lastName, $passwordHash, $loginPreference,
          $phoneNumber, $birthDate, $isActive, $isVerified, $lastLoginAt,
          $createdAt, $updatedAt
        )`,
      )
      .run(this.toRow(account));

    return account;
  }

  async findById(id: string): Promise<CustomerAccount | null> {
    const account = await this.databaseService
      .prepare(`SELECT * FROM "CustomerAccount" WHERE "id" = $id`)
      .get({ $id: id }) as CustomerAccountRow | undefined;

    return account ? this.mapAccount(account) : null;
  }

  async findByEmail(email: string): Promise<CustomerAccount | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const account = await this.databaseService
      .prepare(`SELECT * FROM "CustomerAccount" WHERE "email" = $email`)
      .get({ $email: normalizedEmail }) as CustomerAccountRow | undefined;

    return account ? this.mapAccount(account) : null;
  }

  async touchLastLogin(id: string): Promise<CustomerAccount> {
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "CustomerAccount"
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
      throw new Error(`Customer account ${id} not found after update.`);
    }

    return account;
  }

  async findSocialAccount(
    provider: SocialProvider,
    providerAccountId: string,
  ): Promise<CustomerSocialAccount | null> {
    const account = await this.databaseService
      .prepare(
        `SELECT *
         FROM "CustomerSocialAccount"
         WHERE "provider" = $provider
           AND "providerAccountId" = $providerAccountId
         LIMIT 1`,
      )
      .get({
        $provider: provider,
        $providerAccountId: providerAccountId,
      }) as CustomerSocialAccountRow | undefined;

    return account ? this.mapSocialAccount(account) : null;
  }

  async linkSocialAccount(input: {
    customerAccountId: string;
    provider: SocialProvider;
    providerAccountId: string;
    providerEmail?: string | null;
    profileFirstName?: string | null;
    profileLastName?: string | null;
  }): Promise<CustomerSocialAccount> {
    const now = new Date();
    const existing = await this.findSocialAccount(input.provider, input.providerAccountId);
    if (existing) {
      return existing;
    }

    const linked = await this.databaseService
      .prepare(
        `SELECT *
         FROM "CustomerSocialAccount"
         WHERE "customerAccountId" = $customerAccountId
           AND "provider" = $provider
         LIMIT 1`,
      )
      .get({
        $customerAccountId: input.customerAccountId,
        $provider: input.provider,
      }) as CustomerSocialAccountRow | undefined;

    if (linked) {
      await this.databaseService
        .prepare(
          `UPDATE "CustomerSocialAccount"
           SET "providerAccountId" = $providerAccountId,
               "providerEmail" = $providerEmail,
               "profileFirstName" = $profileFirstName,
               "profileLastName" = $profileLastName,
               "updatedAt" = $updatedAt
           WHERE "id" = $id`,
        )
        .run({
          $id: linked.id,
          $providerAccountId: input.providerAccountId,
          $providerEmail: input.providerEmail ?? null,
          $profileFirstName: input.profileFirstName ?? null,
          $profileLastName: input.profileLastName ?? null,
          $updatedAt: now.toISOString(),
        });

      return this.mapSocialAccount({
        ...linked,
        providerAccountId: input.providerAccountId,
        providerEmail: input.providerEmail ?? null,
        profileFirstName: input.profileFirstName ?? null,
        profileLastName: input.profileLastName ?? null,
        updatedAt: now.toISOString(),
      });
    }

    const socialAccount: CustomerSocialAccount = {
      id: randomUUID(),
      customerAccountId: input.customerAccountId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      providerEmail: input.providerEmail ?? null,
      profileFirstName: input.profileFirstName ?? null,
      profileLastName: input.profileLastName ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "CustomerSocialAccount" (
          "id", "customerAccountId", "provider", "providerAccountId", "providerEmail",
          "profileFirstName", "profileLastName", "createdAt", "updatedAt"
        ) VALUES (
          $id, $customerAccountId, $provider, $providerAccountId, $providerEmail,
          $profileFirstName, $profileLastName, $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: socialAccount.id,
        $customerAccountId: socialAccount.customerAccountId,
        $provider: socialAccount.provider,
        $providerAccountId: socialAccount.providerAccountId,
        $providerEmail: socialAccount.providerEmail,
        $profileFirstName: socialAccount.profileFirstName,
        $profileLastName: socialAccount.profileLastName,
        $createdAt: socialAccount.createdAt.toISOString(),
        $updatedAt: socialAccount.updatedAt.toISOString(),
      });

    return socialAccount;
  }

  private mapAccount(account: CustomerAccountRow): CustomerAccount {
    return {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      passwordHash: account.passwordHash,
      loginPreference: Boolean(account.loginPreference),
      phoneNumber: account.phoneNumber ?? undefined,
      birthDate: account.birthDate ? new Date(account.birthDate) : null,
      isActive: Boolean(account.isActive),
      isVerified: Boolean(account.isVerified),
      lastLoginAt: account.lastLoginAt ? new Date(account.lastLoginAt) : null,
      createdAt: new Date(account.createdAt),
      updatedAt: new Date(account.updatedAt),
    };
  }

  private toRow(account: CustomerAccount) {
    return {
      $id: account.id,
      $email: account.email,
      $firstName: account.firstName,
      $lastName: account.lastName,
      $passwordHash: account.passwordHash,
      $loginPreference: account.loginPreference,
      $phoneNumber: account.phoneNumber ?? null,
      $birthDate: account.birthDate ? account.birthDate.toISOString() : null,
      $isActive: account.isActive,
      $isVerified: account.isVerified,
      $lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
      $createdAt: account.createdAt.toISOString(),
      $updatedAt: account.updatedAt.toISOString(),
    };
  }

  private mapSocialAccount(account: CustomerSocialAccountRow): CustomerSocialAccount {
    return {
      id: account.id,
      customerAccountId: account.customerAccountId,
      provider: account.provider as SocialProvider,
      providerAccountId: account.providerAccountId,
      providerEmail: account.providerEmail,
      profileFirstName: account.profileFirstName,
      profileLastName: account.profileLastName,
      createdAt: new Date(account.createdAt),
      updatedAt: new Date(account.updatedAt),
    };
  }
}

interface CustomerAccountRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  loginPreference: number;
  phoneNumber: string | null;
  birthDate: string | null;
  isActive: number;
  isVerified: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerSocialAccount {
  id: string;
  customerAccountId: string;
  provider: SocialProvider;
  providerAccountId: string;
  providerEmail: string | null;
  profileFirstName: string | null;
  profileLastName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerSocialAccountRow {
  id: string;
  customerAccountId: string;
  provider: string;
  providerAccountId: string;
  providerEmail: string | null;
  profileFirstName: string | null;
  profileLastName: string | null;
  createdAt: string;
  updatedAt: string;
}
