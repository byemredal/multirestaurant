import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AdminAccount, AdminRole } from './entities/admin-account.entity';

@Injectable()
export class AdminUsersStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(id: string): Promise<AdminAccount | null> {
    const row = await this.databaseService
      .prepare(`SELECT * FROM "AdminAccount" WHERE "id" = $id`)
      .get({ $id: id }) as AdminAccountRow | undefined;

    return row ? this.map(row) : null;
  }

  async findByEmail(email: string): Promise<AdminAccount | null> {
    const row = await this.databaseService
      .prepare(`SELECT * FROM "AdminAccount" WHERE "email" = $email`)
      .get({ $email: email.trim().toLowerCase() }) as AdminAccountRow | undefined;

    return row ? this.map(row) : null;
  }

  async touchLastLogin(id: string): Promise<AdminAccount> {
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "AdminAccount"
         SET "lastLoginAt" = $lastLoginAt, "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: id,
        $lastLoginAt: now,
        $updatedAt: now,
      });

    const admin = await this.findById(id);
    if (!admin) {
      throw new Error(`Admin ${id} not found after update.`);
    }

    return admin;
  }

  private map(row: AdminAccountRow): AdminAccount {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role as AdminRole,
      isActive: Boolean(row.isActive),
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

interface AdminAccountRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
