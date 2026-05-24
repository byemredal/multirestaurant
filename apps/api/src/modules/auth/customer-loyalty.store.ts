import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';

type RewardLedgerRow = {
  id: string;
  customerAccountId: string;
  pointsDelta: number;
  balanceAfter: number;
  sourceType: string;
  sourceReferenceId: string | null;
  note: string | null;
  createdAt: string;
};

type StampCardRow = {
  id: string;
  storeId: string;
  storeName: string;
  programName: string;
  rewardTitle: string;
  currentStamps: number;
  stampsRequired: number;
  isCompleted: boolean;
  completedAt: string | null;
  updatedAt: string;
};

type StoreStampProgramRow = {
  id: string;
  storeId: string;
  name: string;
  stampsRequired: number;
  rewardTitle: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class CustomerLoyaltyStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRewardsSummary(customerAccountId: string) {
    const summary = await this.databaseService
      .prepare(
        `SELECT
            COALESCE(MAX("balanceAfter"), 0)::int AS "pointsBalance",
            COUNT(*)::int AS "entryCount"
         FROM "CustomerRewardLedger"
         WHERE "customerAccountId" = $customerAccountId`,
      )
      .get<{ pointsBalance: number; entryCount: number }>({
        $customerAccountId: customerAccountId,
      });

    const history = await this.databaseService
      .prepare(
        `SELECT *
         FROM "CustomerRewardLedger"
         WHERE "customerAccountId" = $customerAccountId
         ORDER BY "createdAt" DESC
         LIMIT 8`,
      )
      .all<RewardLedgerRow>({
        $customerAccountId: customerAccountId,
      });

    return {
      available: Number(summary?.entryCount ?? 0) > 0,
      pointsBalance: Number(summary?.pointsBalance ?? 0),
      history: history.map((entry) => ({
        id: entry.id,
        pointsDelta: Number(entry.pointsDelta),
        balanceAfter: Number(entry.balanceAfter),
        sourceType: entry.sourceType,
        sourceReferenceId: entry.sourceReferenceId,
        note: entry.note,
        createdAt: entry.createdAt,
      })),
      message:
        Number(summary?.entryCount ?? 0) > 0
          ? 'Reward activity is now live for this customer account.'
          : 'No reward activity has been recorded for this customer account yet.',
    };
  }

  async listStampCards(customerAccountId: string) {
    const cards = await this.databaseService
      .prepare(
        `SELECT c."id",
                c."storeId",
                r."name" AS "storeName",
                p."name" AS "programName",
                p."rewardTitle" AS "rewardTitle",
                c."currentStamps",
                p."stampsRequired",
                c."isCompleted",
                c."completedAt",
                c."updatedAt"
         FROM "CustomerStampCard" c
         INNER JOIN "Store" r ON r."id" = c."storeId"
         INNER JOIN "StoreStampProgram" p ON p."id" = c."stampProgramId"
         WHERE c."customerAccountId" = $customerAccountId
         ORDER BY c."updatedAt" DESC`,
      )
      .all<StampCardRow>({
        $customerAccountId: customerAccountId,
      });

    return {
      available: cards.length > 0,
      cards: cards.map((card) => ({
        id: card.id,
        storeId: card.storeId,
        storeName: card.storeName,
        programName: card.programName,
        rewardTitle: card.rewardTitle,
        currentStamps: Number(card.currentStamps),
        stampsRequired: Number(card.stampsRequired),
        isCompleted: Boolean(card.isCompleted),
        completedAt: card.completedAt,
        updatedAt: card.updatedAt,
      })),
      message:
        cards.length > 0
          ? 'Active stamp cards found for this customer account.'
          : 'No stamp cards have been started for this customer account yet.',
    };
  }

  async seedRewardEntry(input: {
    customerAccountId: string;
    pointsDelta: number;
    sourceType: string;
    sourceReferenceId?: string | null;
    note?: string | null;
  }) {
    if (input.sourceReferenceId) {
      const existing = await this.databaseService
        .prepare(
          `SELECT "id"
           FROM "CustomerRewardLedger"
           WHERE "customerAccountId" = $customerAccountId
             AND "sourceType" = $sourceType
             AND "sourceReferenceId" = $sourceReferenceId
           LIMIT 1`,
        )
        .get({
          $customerAccountId: input.customerAccountId,
          $sourceType: input.sourceType,
          $sourceReferenceId: input.sourceReferenceId,
        });

      if (existing) {
        return;
      }
    }

    const current = await this.getRewardsSummary(input.customerAccountId);
    const balanceAfter = current.pointsBalance + input.pointsDelta;

    await this.databaseService
      .prepare(
        `INSERT INTO "CustomerRewardLedger" (
          "id", "customerAccountId", "pointsDelta", "balanceAfter", "sourceType",
          "sourceReferenceId", "note", "createdAt"
        ) VALUES (
          $id, $customerAccountId, $pointsDelta, $balanceAfter, $sourceType,
          $sourceReferenceId, $note, $createdAt
        )`,
      )
      .run({
        $id: randomUUID(),
        $customerAccountId: input.customerAccountId,
        $pointsDelta: input.pointsDelta,
        $balanceAfter: balanceAfter,
        $sourceType: input.sourceType,
        $sourceReferenceId: input.sourceReferenceId ?? null,
        $note: input.note ?? null,
        $createdAt: new Date().toISOString(),
      });
  }

  async recordCompletedOrderReward(input: {
    customerAccountId: string;
    storeId: string;
    orderId: string;
    totalAmount: number;
    currency: string;
  }) {
    const pointsDelta = Math.max(1, Math.round(Number(input.totalAmount)));
    await this.seedRewardEntry({
      customerAccountId: input.customerAccountId,
      pointsDelta,
      sourceType: 'order_completed',
      sourceReferenceId: input.orderId,
      note: `Completed order reward for ${input.totalAmount.toFixed(2)} ${input.currency}.`,
    });

    const stampProgram = await this.findOrCreateStampProgram(input.storeId);
    const existingCard = await this.databaseService
      .prepare(
        `SELECT *
         FROM "CustomerStampCard"
         WHERE "customerAccountId" = $customerAccountId
           AND "storeId" = $storeId
         LIMIT 1`,
      )
      .get<{
        id: string;
        currentStamps: number;
        isCompleted: boolean;
      }>({
        $customerAccountId: input.customerAccountId,
        $storeId: input.storeId,
      });

    const now = new Date().toISOString();
    if (!existingCard) {
      const currentStamps = Math.min(1, Number(stampProgram.stampsRequired));
      await this.databaseService
        .prepare(
          `INSERT INTO "CustomerStampCard" (
            "id", "customerAccountId", "storeId", "stampProgramId",
            "currentStamps", "isCompleted", "completedAt", "createdAt", "updatedAt"
          ) VALUES (
            $id, $customerAccountId, $storeId, $stampProgramId,
            $currentStamps, $isCompleted, $completedAt, $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: randomUUID(),
          $customerAccountId: input.customerAccountId,
          $storeId: input.storeId,
          $stampProgramId: stampProgram.id,
          $currentStamps: currentStamps,
          $isCompleted: currentStamps >= Number(stampProgram.stampsRequired),
          $completedAt:
            currentStamps >= Number(stampProgram.stampsRequired) ? now : null,
          $createdAt: now,
          $updatedAt: now,
        });
      return;
    }

    if (Boolean(existingCard.isCompleted)) {
      return;
    }

    const nextStampCount = Math.min(
      Number(existingCard.currentStamps) + 1,
      Number(stampProgram.stampsRequired),
    );
    const isCompleted = nextStampCount >= Number(stampProgram.stampsRequired);

    await this.databaseService
      .prepare(
        `UPDATE "CustomerStampCard"
         SET "stampProgramId" = $stampProgramId,
             "currentStamps" = $currentStamps,
             "isCompleted" = $isCompleted,
             "completedAt" = $completedAt,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: existingCard.id,
        $stampProgramId: stampProgram.id,
        $currentStamps: nextStampCount,
        $isCompleted: isCompleted,
        $completedAt: isCompleted ? now : null,
        $updatedAt: now,
      });
  }

  private async findOrCreateStampProgram(storeId: string) {
    const program = await this.databaseService
      .prepare(
        `SELECT *
         FROM "StoreStampProgram"
         WHERE "storeId" = $storeId
         LIMIT 1`,
      )
      .get<StoreStampProgramRow>({
        $storeId: storeId,
      });

    if (program) {
      return program;
    }

    const now = new Date().toISOString();
    const created: StoreStampProgramRow = {
      id: randomUUID(),
      storeId,
      name: 'House loyalty',
      stampsRequired: 6,
      rewardTitle: 'Free reward after 6 orders',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "StoreStampProgram" (
          "id", "storeId", "name", "stampsRequired", "rewardTitle",
          "isActive", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $name, $stampsRequired, $rewardTitle,
          $isActive, $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: created.id,
        $storeId: created.storeId,
        $name: created.name,
        $stampsRequired: created.stampsRequired,
        $rewardTitle: created.rewardTitle,
        $isActive: created.isActive,
        $createdAt: created.createdAt,
        $updatedAt: created.updatedAt,
      });

    return created;
  }
}
