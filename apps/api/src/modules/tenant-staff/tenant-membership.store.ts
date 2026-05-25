import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  TenantMembership,
  TenantMembershipRole,
} from '../tenants/entities/tenant-membership.entity';
import { MembershipStatus } from '../tenants/entities/admin-membership.entity';

interface TenantMembershipRow {
  id: string;
  tenantAccountId: string;
  tenantBusinessId: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Thin reader for TenantMembership rows. Owned by tenant-staff because it
 * is the only consumer today; if a second consumer appears it can move
 * into the tenants module.
 */
@Injectable()
export class TenantMembershipStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async listForTenantAccount(tenantAccountId: string): Promise<TenantMembership[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "TenantMembership"
         WHERE "tenantAccountId" = $tenantAccountId
         ORDER BY "createdAt" ASC`,
      )
      .all({ $tenantAccountId: tenantAccountId })) as TenantMembershipRow[];
    return rows.map((row) => this.mapMembership(row));
  }

  private mapMembership(row: TenantMembershipRow): TenantMembership {
    return {
      id: row.id,
      tenantAccountId: row.tenantAccountId,
      tenantBusinessId: row.tenantBusinessId,
      role: row.role as TenantMembershipRole,
      status: row.status as MembershipStatus,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
