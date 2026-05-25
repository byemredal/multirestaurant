import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { AuthSubjectType } from './auth-subject.type';

export interface RefreshSessionRecord {
  id: string;
  token: string;
  subjectId: string;
  subjectType: AuthSubjectType;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class RefreshSessionsStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async save(session: RefreshSessionRecord): Promise<RefreshSessionRecord> {
    await this.databaseService
      .prepare(
        `INSERT INTO "RefreshSession" (
          "id", "token", "subjectType",
          "customerAccountId", "tenantAccountId", "staffAccountId", "adminAccountId",
          "expiresAt", "isRevoked", "createdAt", "revokedAt"
        ) VALUES (
          $id, $token, $subjectType,
          $customerAccountId, $tenantAccountId, $staffAccountId, $adminAccountId,
          $expiresAt, $isRevoked, $createdAt, $revokedAt
        )`,
      )
      .run({
        $id: session.id,
        $token: this.hashToken(session.token),
        $subjectType: session.subjectType,
        $customerAccountId:
          session.subjectType === 'customer' ? session.subjectId : null,
        $tenantAccountId:
          session.subjectType === 'tenant' ? session.subjectId : null,
        $staffAccountId:
          session.subjectType === 'staff' ? session.subjectId : null,
        $adminAccountId:
          session.subjectType === 'admin' ? session.subjectId : null,
        $expiresAt: session.expiresAt.toISOString(),
        $isRevoked: session.isRevoked,
        $createdAt: session.createdAt.toISOString(),
        $revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
      });

    return session;
  }

  async findActive(
    token: string,
    subjectType: AuthSubjectType,
  ): Promise<RefreshSessionRecord | null> {
    const hashedToken = this.hashToken(token);
    const session = await this.databaseService
      .prepare(`SELECT * FROM "RefreshSession" WHERE "token" = $token`)
      .get({ $token: hashedToken }) as RefreshSessionRow | undefined;

    if (!session || Boolean(session.isRevoked) || session.subjectType !== subjectType) {
      return null;
    }

    const mapped = this.fromStoredRecord(session);
    if (mapped.expiresAt.getTime() <= Date.now()) {
      await this.revoke(token);
      return null;
    }

    return mapped;
  }

  async revoke(token: string): Promise<void> {
    const hashedToken = this.hashToken(token);
    await this.databaseService
      .prepare(
        `UPDATE "RefreshSession"
         SET "isRevoked" = TRUE, "revokedAt" = $revokedAt
         WHERE "token" = $token AND "isRevoked" = FALSE`,
      )
      .run({
        $token: hashedToken,
        $revokedAt: new Date().toISOString(),
      });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private fromStoredRecord(record: RefreshSessionRow): RefreshSessionRecord {
    return {
      id: record.id,
      token: '',
      subjectId:
        record.customerAccountId ??
        record.tenantAccountId ??
        record.staffAccountId ??
        record.adminAccountId ??
        '',
      subjectType: record.subjectType,
      expiresAt: new Date(record.expiresAt),
      isRevoked: Boolean(record.isRevoked),
      createdAt: new Date(record.createdAt),
      revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
    };
  }
}

interface RefreshSessionRow {
  id: string;
  token: string;
  subjectType: AuthSubjectType;
  customerAccountId: string | null;
  tenantAccountId: string | null;
  staffAccountId: string | null;
  adminAccountId: string | null;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
  revokedAt: string | null;
}
