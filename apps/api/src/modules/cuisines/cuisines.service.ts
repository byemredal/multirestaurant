import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { StoresService } from '../stores/stores.service';
import { ReplaceStoreCuisinesDto } from './dto/replace-store-cuisines.dto';
import { Cuisine, StoreCuisineDetail } from './entities/cuisine.entity';

interface CuisineRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface StoreCuisineRow extends CuisineRow {
  isPrimary: boolean;
}

@Injectable()
export class CuisinesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storesService: StoresService,
  ) {}

  async listActive(): Promise<Cuisine[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "Cuisine"
         WHERE "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "name" ASC`,
      )
      .all({})) as unknown as CuisineRow[];

    return rows.map((row) => this.mapCuisine(row));
  }

  async listForStorePublic(storeId: string): Promise<StoreCuisineDetail[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT c.*, rc."isPrimary"
         FROM "StoreCuisine" rc
         INNER JOIN "Cuisine" c ON c."id" = rc."cuisineId"
         WHERE rc."storeId" = $storeId AND c."isActive" = TRUE
         ORDER BY rc."isPrimary" DESC, c."sortOrder" ASC, c."name" ASC`,
      )
      .all({ $storeId: storeId })) as unknown as StoreCuisineRow[];

    return rows.map((row) => ({
      ...this.mapCuisine(row),
      isPrimary: Boolean(row.isPrimary),
    }));
  }

  async listForStoreTenant(storeId: string, ownerTenantId: string) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    return this.listForStorePublic(storeId);
  }

  async replaceStoreCuisines(
    storeId: string,
    ownerTenantId: string,
    dto: ReplaceStoreCuisinesDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    if (dto.primaryCuisineId && !dto.cuisineIds.includes(dto.primaryCuisineId)) {
      throw new BadRequestException(
        'primaryCuisineId must be one of the cuisineIds being assigned.',
      );
    }

    if (dto.cuisineIds.length > 0) {
      const existing = (await this.databaseService
        .prepare(
          `SELECT "id" FROM "Cuisine"
           WHERE "id" = ANY($ids::uuid[]) AND "isActive" = TRUE`,
        )
        .all({ $ids: dto.cuisineIds })) as Array<{ id: string }>;

      if (existing.length !== dto.cuisineIds.length) {
        throw new BadRequestException(
          'One or more cuisineIds are unknown or no longer active.',
        );
      }
    }

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(`DELETE FROM "StoreCuisine" WHERE "storeId" = $storeId`)
        .run({ $storeId: storeId });

      for (const cuisineId of dto.cuisineIds) {
        const isPrimary =
          dto.primaryCuisineId === cuisineId ||
          (!dto.primaryCuisineId && cuisineId === dto.cuisineIds[0]);
        await this.databaseService
          .prepare(
            `INSERT INTO "StoreCuisine" ("storeId", "cuisineId", "isPrimary")
             VALUES ($storeId, $cuisineId, $isPrimary)`,
          )
          .run({
            $storeId: storeId,
            $cuisineId: cuisineId,
            $isPrimary: isPrimary,
          });
      }
    });

    return {
      cuisines: await this.listForStorePublic(storeId),
    };
  }

  private async ensureOwnedStore(storeId: string, ownerTenantId: string) {
    const store = await this.storesService.findOwnedStore(
      storeId,
      ownerTenantId,
    );

    if (!store) {
      throw new ForbiddenException('You can only manage cuisines for your own stores.');
    }

    return store;
  }

  private mapCuisine(row: CuisineRow): Cuisine {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      sortOrder: row.sortOrder,
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    };
  }

  async getCuisinesForStoreIds(storeIds: string[]): Promise<
    Record<string, StoreCuisineDetail[]>
  > {
    if (storeIds.length === 0) {
      return {};
    }
    const rows = (await this.databaseService
      .prepare(
        `SELECT rc."storeId" AS "storeId", c.*, rc."isPrimary"
         FROM "StoreCuisine" rc
         INNER JOIN "Cuisine" c ON c."id" = rc."cuisineId"
         WHERE rc."storeId" = ANY($storeIds::uuid[]) AND c."isActive" = TRUE
         ORDER BY rc."isPrimary" DESC, c."sortOrder" ASC, c."name" ASC`,
      )
      .all({ $storeIds: storeIds })) as unknown as Array<
      StoreCuisineRow & { storeId: string }
    >;

    const result: Record<string, StoreCuisineDetail[]> = {};
    for (const row of rows) {
      const list = (result[row.storeId] = result[row.storeId] ?? []);
      list.push({ ...this.mapCuisine(row), isPrimary: Boolean(row.isPrimary) });
    }
    return result;
  }
}
