import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { StoresService } from '../stores/stores.service';
import {
  ConsentAction,
  ConsentChannel,
  ConsentEvent,
  ConsentSubjectType,
  MARKETING_CONSENT_CHANNELS,
  MarketingConsent,
  MarketingConsentChannel,
  MarketingConsentSnapshot,
  MarketingConsentSubjectType,
  OrderLegalAcceptance,
  StoreTermsAddendum,
} from './entities/consent-event.entity';
import {
  LegalDocumentType,
  LegalDocumentTypeCode,
  REQUIRED_CHECKOUT_DOCUMENT_CODES,
} from './entities/legal-document-type.entity';
import {
  PLATFORM_LEGAL_DOCUMENT_BODY_FORMATS,
  PlatformLegalDocument,
  PlatformLegalDocumentAudience,
  PlatformLegalDocumentBodyFormat,
  PlatformLegalDocumentVersion,
  PlatformLegalDocumentWithCurrentVersion,
} from './entities/platform-legal-document.entity';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { PublishDocumentVersionDto } from './dto/publish-document-version.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { CreateOrderLegalAcceptanceDto } from './dto/create-order-legal-acceptance.dto';
import { UpsertMarketingConsentDto } from './dto/upsert-marketing-consent.dto';
import { UpsertStoreTermsAddendumDto } from './dto/upsert-store-terms-addendum.dto';

interface AcceptanceContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface LegalDocumentTypeRow {
  id: string;
  code: LegalDocumentTypeCode;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface PlatformLegalDocumentRow {
  id: string;
  typeId: string;
  typeCode: LegalDocumentTypeCode | null;
  code: string;
  audience: PlatformLegalDocumentAudience;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface PlatformLegalDocumentVersionRow {
  id: string;
  documentId: string;
  versionLabel: string;
  locale: string;
  title: string;
  body: string;
  bodyFormat: PlatformLegalDocumentBodyFormat;
  contentHashSha256: string;
  effectiveFrom: string | Date;
  publishedAt: string | Date;
  supersededAt: string | Date | null;
  createdByAdminId: string | null;
  createdAt: string | Date;
}

interface ConsentEventRow {
  id: string;
  subjectType: ConsentSubjectType;
  customerAccountId: string | null;
  tenantAccountId: string | null;
  anonymousIdentifier: string | null;
  documentVersionId: string;
  action: ConsentAction;
  ipAddress: string | null;
  userAgent: string | null;
  channel: ConsentChannel;
  contextRef: string | null;
  acceptedAt: string | Date;
  createdAt: string | Date;
}

interface OrderLegalAcceptanceRow {
  id: string;
  orderId: string;
  distanceSalesContractVersionId: string;
  preInformationFormVersionId: string;
  acceptedAt: string | Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | Date;
}

interface MarketingConsentRow {
  id: string;
  subjectType: MarketingConsentSubjectType;
  customerAccountId: string | null;
  tenantAccountId: string | null;
  channel: MarketingConsentChannel;
  action: 'granted' | 'revoked';
  source: string | null;
  iysReferenceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | Date;
}

interface StoreTermsAddendumRow {
  id: string;
  storeId: string;
  parentDocumentVersionId: string;
  title: string;
  body: string;
  locale: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const DEFAULT_LOCALE = 'tr';

@Injectable()
export class LegalConsentService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogService: AdminAuditLogService,
    private readonly storesService: StoresService,
  ) {}

  // ===================================================================
  // 1. SYSTEM TAXONOMY — LegalDocumentType
  // ===================================================================

  async listDocumentTypes(includeInactive = false): Promise<LegalDocumentType[]> {
    const sql = includeInactive
      ? `SELECT * FROM "LegalDocumentType" ORDER BY "sortOrder" ASC, "displayName" ASC`
      : `SELECT * FROM "LegalDocumentType" WHERE "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "displayName" ASC`;

    const rows = (await this.databaseService
      .prepare(sql)
      .all({})) as unknown as LegalDocumentTypeRow[];

    return rows.map((row) => this.mapDocumentType(row));
  }

  // ===================================================================
  // 2. PlatformLegalDocument — admin CRUD
  // ===================================================================

  async createDocument(dto: CreateLegalDocumentDto, adminId: string) {
    const type = await this.findDocumentTypeById(dto.typeId);
    if (!type) {
      throw new NotFoundException('LegalDocumentType not found.');
    }

    const existing = await this.databaseService
      .prepare(`SELECT "id" FROM "PlatformLegalDocument" WHERE "code" = $code`)
      .get({ $code: dto.code });
    if (existing) {
      throw new ConflictException(`A document with code "${dto.code}" already exists.`);
    }

    const row = (await this.databaseService
      .prepare(
        `INSERT INTO "PlatformLegalDocument"
           ("typeId", "code", "audience", "isRequired", "isActive")
         VALUES ($typeId, $code, $audience, $isRequired, $isActive)
         RETURNING *`,
      )
      .get({
        $typeId: dto.typeId,
        $code: dto.code,
        $audience: dto.audience,
        $isRequired: dto.isRequired ?? true,
        $isActive: dto.isActive ?? true,
      })) as unknown as PlatformLegalDocumentRow;

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'platform_legal_document_created',
      entityType: 'platform_legal_document',
      entityId: row.id,
      metadata: { typeId: dto.typeId, code: dto.code, audience: dto.audience },
    });

    return this.mapDocument({ ...row, typeCode: type.code });
  }

  async listDocuments(filter?: {
    audience?: PlatformLegalDocumentAudience;
    includeInactive?: boolean;
  }): Promise<PlatformLegalDocumentWithCurrentVersion[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter?.audience) {
      conditions.push(`d."audience" IN ($audience, 'all')`);
      params.$audience = filter.audience;
    }
    if (!filter?.includeInactive) {
      conditions.push(`d."isActive" = TRUE`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const docRows = (await this.databaseService
      .prepare(
        `SELECT d.*, t."code" AS "typeCode"
         FROM "PlatformLegalDocument" d
         INNER JOIN "LegalDocumentType" t ON t."id" = d."typeId"
         ${where}
         ORDER BY t."sortOrder" ASC, d."createdAt" ASC`,
      )
      .all(params)) as unknown as PlatformLegalDocumentRow[];

    if (docRows.length === 0) {
      return [];
    }

    const documentIds = docRows.map((row) => row.id);
    const currentVersionsByDoc = await this.findCurrentVersionsForDocuments(
      documentIds,
      DEFAULT_LOCALE,
    );

    return docRows.map((row) => ({
      ...this.mapDocument(row),
      currentVersion: currentVersionsByDoc.get(row.id) ?? null,
    }));
  }

  async updateDocument(
    documentId: string,
    dto: UpdateLegalDocumentDto,
    adminId: string,
  ) {
    const existing = await this.findDocumentById(documentId);
    if (!existing) {
      throw new NotFoundException('PlatformLegalDocument not found.');
    }

    const fields: string[] = [];
    const params: Record<string, unknown> = { $id: documentId };
    if (dto.audience !== undefined) {
      fields.push(`"audience" = $audience`);
      params.$audience = dto.audience;
    }
    if (dto.isRequired !== undefined) {
      fields.push(`"isRequired" = $isRequired`);
      params.$isRequired = dto.isRequired;
    }
    if (dto.isActive !== undefined) {
      fields.push(`"isActive" = $isActive`);
      params.$isActive = dto.isActive;
    }
    if (fields.length === 0) {
      return this.mapDocument(existing);
    }
    fields.push(`"updatedAt" = NOW()`);

    const row = (await this.databaseService
      .prepare(
        `UPDATE "PlatformLegalDocument"
         SET ${fields.join(', ')}
         WHERE "id" = $id
         RETURNING *`,
      )
      .get(params)) as unknown as PlatformLegalDocumentRow;

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'platform_legal_document_updated',
      entityType: 'platform_legal_document',
      entityId: documentId,
      metadata: {
        before: {
          audience: existing.audience,
          isRequired: existing.isRequired,
          isActive: existing.isActive,
        },
        after: { audience: dto.audience, isRequired: dto.isRequired, isActive: dto.isActive },
      },
    });

    return this.mapDocument({ ...row, typeCode: existing.typeCode ?? null });
  }

  async getDocumentByCode(
    code: string,
    locale = DEFAULT_LOCALE,
  ): Promise<PlatformLegalDocumentWithCurrentVersion | null> {
    const docRow = (await this.databaseService
      .prepare(
        `SELECT d.*, t."code" AS "typeCode"
         FROM "PlatformLegalDocument" d
         INNER JOIN "LegalDocumentType" t ON t."id" = d."typeId"
         WHERE d."code" = $code AND d."isActive" = TRUE
         LIMIT 1`,
      )
      .get({ $code: code })) as unknown as PlatformLegalDocumentRow | undefined;

    if (!docRow) {
      return null;
    }

    const version = await this.findCurrentVersion(docRow.id, locale);
    return { ...this.mapDocument(docRow), currentVersion: version };
  }

  // ===================================================================
  // 3. PlatformLegalDocumentVersion — IMMUTABLE publish
  // ===================================================================

  async publishVersion(
    documentId: string,
    dto: PublishDocumentVersionDto,
    adminId: string,
  ) {
    const docRow = await this.findDocumentById(documentId);
    if (!docRow) {
      throw new NotFoundException('PlatformLegalDocument not found.');
    }

    const labelClash = await this.databaseService
      .prepare(
        `SELECT "id" FROM "PlatformLegalDocumentVersion"
         WHERE "documentId" = $documentId
           AND "versionLabel" = $versionLabel
           AND "locale" = $locale`,
      )
      .get({
        $documentId: documentId,
        $versionLabel: dto.versionLabel,
        $locale: dto.locale,
      });
    if (labelClash) {
      throw new ConflictException(
        `Version "${dto.versionLabel}" already exists for locale "${dto.locale}".`,
      );
    }

    const bodyFormat: PlatformLegalDocumentBodyFormat =
      dto.bodyFormat && PLATFORM_LEGAL_DOCUMENT_BODY_FORMATS.includes(dto.bodyFormat)
        ? dto.bodyFormat
        : 'markdown';
    const contentHash = createHash('sha256').update(dto.body, 'utf8').digest('hex');
    const supersedeCurrent = dto.supersedeCurrent !== false;

    const result = await this.databaseService.transaction(async () => {
      let supersededVersionId: string | null = null;
      if (supersedeCurrent) {
        const current = await this.findCurrentVersion(documentId, dto.locale);
        if (current) {
          await this.databaseService
            .prepare(
              `UPDATE "PlatformLegalDocumentVersion"
                 SET "supersededAt" = NOW()
                 WHERE "id" = $id`,
            )
            .run({ $id: current.id });
          supersededVersionId = current.id;
        }
      }

      const versionRow = (await this.databaseService
        .prepare(
          `INSERT INTO "PlatformLegalDocumentVersion"
             ("documentId", "versionLabel", "locale", "title", "body",
              "bodyFormat", "contentHashSha256", "effectiveFrom",
              "createdByAdminId")
           VALUES ($documentId, $versionLabel, $locale, $title, $body,
                   $bodyFormat, $contentHash, $effectiveFrom, $adminId)
           RETURNING *`,
        )
        .get({
          $documentId: documentId,
          $versionLabel: dto.versionLabel,
          $locale: dto.locale,
          $title: dto.title,
          $body: dto.body,
          $bodyFormat: bodyFormat,
          $contentHash: contentHash,
          $effectiveFrom: dto.effectiveFrom ?? new Date().toISOString(),
          $adminId: adminId,
        })) as unknown as PlatformLegalDocumentVersionRow;

      return { versionRow, supersededVersionId };
    });

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'platform_legal_document_version_published',
      entityType: 'platform_legal_document_version',
      entityId: result.versionRow.id,
      metadata: {
        documentId,
        versionLabel: dto.versionLabel,
        locale: dto.locale,
        supersededVersionId: result.supersededVersionId,
        contentHashSha256: contentHash,
      },
    });

    return this.mapVersion(result.versionRow);
  }

  async supersedeVersion(versionId: string, adminId: string) {
    const version = (await this.databaseService
      .prepare(`SELECT * FROM "PlatformLegalDocumentVersion" WHERE "id" = $id`)
      .get({ $id: versionId })) as unknown as PlatformLegalDocumentVersionRow | undefined;
    if (!version) {
      throw new NotFoundException('PlatformLegalDocumentVersion not found.');
    }
    if (version.supersededAt) {
      throw new ConflictException('Version is already superseded.');
    }

    await this.databaseService
      .prepare(
        `UPDATE "PlatformLegalDocumentVersion"
           SET "supersededAt" = NOW()
           WHERE "id" = $id`,
      )
      .run({ $id: versionId });

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'platform_legal_document_version_superseded',
      entityType: 'platform_legal_document_version',
      entityId: versionId,
      metadata: { documentId: version.documentId, versionLabel: version.versionLabel },
    });

    return { ok: true };
  }

  async listVersions(documentId: string, locale?: string) {
    const conditions = [`"documentId" = $documentId`];
    const params: Record<string, unknown> = { $documentId: documentId };
    if (locale) {
      conditions.push(`"locale" = $locale`);
      params.$locale = locale;
    }
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "PlatformLegalDocumentVersion"
         WHERE ${conditions.join(' AND ')}
         ORDER BY "publishedAt" DESC`,
      )
      .all(params)) as unknown as PlatformLegalDocumentVersionRow[];
    return rows.map((row) => this.mapVersion(row));
  }

  // ===================================================================
  // 4. Public read — active legal documents bundle
  // ===================================================================

  async listActiveBundle(
    audience: PlatformLegalDocumentAudience,
    locale = DEFAULT_LOCALE,
  ): Promise<PlatformLegalDocumentWithCurrentVersion[]> {
    return this.listDocuments({ audience, includeInactive: false }).then((docs) =>
      docs.map((doc) =>
        doc.currentVersion && doc.currentVersion.locale === locale
          ? doc
          : { ...doc, currentVersion: doc.currentVersion },
      ),
    );
  }

  async getLatestByCode(code: string, locale = DEFAULT_LOCALE) {
    const doc = await this.getDocumentByCode(code, locale);
    if (!doc) {
      throw new NotFoundException(`No legal document found with code "${code}".`);
    }
    return doc;
  }

  // ===================================================================
  // 5. ConsentEvent — append-only
  // ===================================================================

  async recordConsent(
    subject: {
      type: ConsentSubjectType;
      customerAccountId?: string | null;
      tenantAccountId?: string | null;
      anonymousIdentifier?: string | null;
    },
    dto: RecordConsentDto,
    context: AcceptanceContext,
  ): Promise<ConsentEvent[]> {
    if (subject.type === 'customer' && !subject.customerAccountId) {
      throw new BadRequestException(
        'customerAccountId is required for customer consent.',
      );
    }
    if (subject.type === 'tenant' && !subject.tenantAccountId) {
      throw new BadRequestException(
        'tenantAccountId is required for tenant consent.',
      );
    }
    if (subject.type === 'anonymous' && !subject.anonymousIdentifier) {
      throw new BadRequestException(
        'anonymousIdentifier is required for anonymous consent.',
      );
    }

    const versionIds = dto.entries.map((entry) => entry.documentVersionId);
    const versionRows = (await this.databaseService
      .prepare(
        `SELECT v.*, d."isActive" AS "documentIsActive"
         FROM "PlatformLegalDocumentVersion" v
         INNER JOIN "PlatformLegalDocument" d ON d."id" = v."documentId"
         WHERE v."id" = ANY($ids::uuid[])`,
      )
      .all({ $ids: versionIds })) as unknown as Array<
      PlatformLegalDocumentVersionRow & { documentIsActive: boolean }
    >;

    if (versionRows.length !== versionIds.length) {
      throw new BadRequestException('One or more documentVersionId values are unknown.');
    }

    const inserted: ConsentEvent[] = [];
    await this.databaseService.transaction(async () => {
      for (const entry of dto.entries) {
        const row = (await this.databaseService
          .prepare(
            `INSERT INTO "ConsentEvent"
               ("subjectType", "customerAccountId", "tenantAccountId",
                "anonymousIdentifier", "documentVersionId", "action",
                "ipAddress", "userAgent", "channel", "contextRef")
             VALUES ($subjectType, $customerId, $tenantId, $anonId,
                     $versionId, $action, $ip, $ua, $channel, $contextRef)
             RETURNING *`,
          )
          .get({
            $subjectType: subject.type,
            $customerId: subject.type === 'customer' ? subject.customerAccountId : null,
            $tenantId: subject.type === 'tenant' ? subject.tenantAccountId : null,
            $anonId:
              subject.type === 'anonymous'
                ? subject.anonymousIdentifier
                : dto.anonymousIdentifier ?? null,
            $versionId: entry.documentVersionId,
            $action: entry.action ?? 'granted',
            $ip: context.ipAddress ?? null,
            $ua: context.userAgent ?? null,
            $channel: dto.channel,
            $contextRef: entry.contextRef ?? null,
          })) as unknown as ConsentEventRow;
        inserted.push(this.mapConsent(row));
      }
    });

    await this.auditLogService.log({
      actorType: subject.type,
      actorId:
        subject.customerAccountId ?? subject.tenantAccountId ?? subject.anonymousIdentifier,
      action: 'consent_event_recorded',
      entityType: 'consent_event',
      entityId: inserted[0]?.id ?? 'batch',
      metadata: {
        channel: dto.channel,
        count: inserted.length,
        versionIds,
      },
    });

    return inserted;
  }

  async listConsentsForCustomer(customerAccountId: string): Promise<ConsentEvent[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "ConsentEvent"
         WHERE "customerAccountId" = $customerId
         ORDER BY "acceptedAt" DESC
         LIMIT 200`,
      )
      .all({ $customerId: customerAccountId })) as unknown as ConsentEventRow[];
    return rows.map((row) => this.mapConsent(row));
  }

  async listConsentsForTenant(tenantAccountId: string): Promise<ConsentEvent[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "ConsentEvent"
         WHERE "tenantAccountId" = $tenantId
         ORDER BY "acceptedAt" DESC
         LIMIT 200`,
      )
      .all({ $tenantId: tenantAccountId })) as unknown as ConsentEventRow[];
    return rows.map((row) => this.mapConsent(row));
  }

  // ===================================================================
  // 6. Re-consent engine utilities
  // ===================================================================

  async hasAcceptedLatestVersion(
    subject: { customerAccountId?: string; tenantAccountId?: string },
    documentCode: string,
    locale = DEFAULT_LOCALE,
  ): Promise<boolean> {
    const doc = await this.getDocumentByCode(documentCode, locale);
    if (!doc || !doc.currentVersion) {
      return false;
    }

    const accepted = (await this.databaseService
      .prepare(
        `SELECT 1 FROM "ConsentEvent"
         WHERE "documentVersionId" = $versionId
           AND "action" = 'granted'
           AND (
             ($customerId::uuid IS NOT NULL AND "customerAccountId" = $customerId)
             OR ($tenantId::uuid IS NOT NULL AND "tenantAccountId" = $tenantId)
           )
         LIMIT 1`,
      )
      .get({
        $versionId: doc.currentVersion.id,
        $customerId: subject.customerAccountId ?? null,
        $tenantId: subject.tenantAccountId ?? null,
      })) as { '?column?': number } | undefined;

    return Boolean(accepted);
  }

  async requiresReConsent(
    audience: PlatformLegalDocumentAudience,
    subject: { customerAccountId?: string; tenantAccountId?: string },
  ): Promise<{ requires: boolean; missingDocumentCodes: string[] }> {
    const docs = await this.listDocuments({ audience, includeInactive: false });
    const missing: string[] = [];
    for (const doc of docs) {
      if (!doc.isRequired) continue;
      if (!doc.currentVersion) continue;
      const ok = await this.hasAcceptedLatestVersion(subject, doc.code);
      if (!ok) missing.push(doc.code);
    }
    return { requires: missing.length > 0, missingDocumentCodes: missing };
  }

  /**
   * Platform-level checkout legal readiness: are the required customer
   * checkout documents (distance-sales contract + pre-information form)
   * published with a current version? This is distinct from
   * requiresReConsent() — it checks whether the platform has configured the
   * documents at all, not whether a given subject has accepted them.
   */
  async getCheckoutLegalReadiness(): Promise<{
    legalReady: boolean;
    missingLegalDocuments: string[];
  }> {
    const docs = await this.listDocuments({
      audience: 'customer',
      includeInactive: false,
    });
    const missing: string[] = [];
    for (const code of REQUIRED_CHECKOUT_DOCUMENT_CODES) {
      const doc = docs.find((d) => d.typeCode === code);
      if (!doc?.currentVersion) missing.push(code);
    }
    return { legalReady: missing.length === 0, missingLegalDocuments: missing };
  }

  // ===================================================================
  // 7. OrderLegalAcceptance
  // ===================================================================

  async createOrderLegalAcceptance(
    customerAccountId: string,
    dto: CreateOrderLegalAcceptanceDto,
    context: AcceptanceContext,
  ): Promise<OrderLegalAcceptance> {
    const order = (await this.databaseService
      .prepare(
        `SELECT "id", "customerAccountId", "status" FROM "Order" WHERE "id" = $id`,
      )
      .get({ $id: dto.orderId })) as
      | { id: string; customerAccountId: string; status: string }
      | undefined;

    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.customerAccountId !== customerAccountId) {
      throw new ForbiddenException('You can only accept legal terms for your own orders.');
    }

    const existing = await this.findAcceptanceByOrderId(dto.orderId);
    if (existing) {
      throw new ConflictException('Order legal acceptance already exists for this order.');
    }

    const requiredVersions = await this.databaseService
      .prepare(
        `SELECT v."id", d."code"
         FROM "PlatformLegalDocumentVersion" v
         INNER JOIN "PlatformLegalDocument" d ON d."id" = v."documentId"
         WHERE v."id" = ANY($ids::uuid[])`,
      )
      .all({
        $ids: [dto.distanceSalesContractVersionId, dto.preInformationFormVersionId],
      });
    if (requiredVersions.length !== 2) {
      throw new BadRequestException('Provided legal version ids are invalid.');
    }

    const row = (await this.databaseService
      .prepare(
        `INSERT INTO "OrderLegalAcceptance"
           ("orderId", "distanceSalesContractVersionId",
            "preInformationFormVersionId", "ipAddress", "userAgent")
         VALUES ($orderId, $distanceSalesId, $preInfoId, $ip, $ua)
         RETURNING *`,
      )
      .get({
        $orderId: dto.orderId,
        $distanceSalesId: dto.distanceSalesContractVersionId,
        $preInfoId: dto.preInformationFormVersionId,
        $ip: context.ipAddress ?? null,
        $ua: context.userAgent ?? null,
      })) as unknown as OrderLegalAcceptanceRow;

    await this.auditLogService.log({
      actorType: 'customer',
      actorId: customerAccountId,
      action: 'order_legal_acceptance_created',
      entityType: 'order_legal_acceptance',
      entityId: row.id,
      metadata: {
        orderId: dto.orderId,
        distanceSalesContractVersionId: dto.distanceSalesContractVersionId,
        preInformationFormVersionId: dto.preInformationFormVersionId,
      },
    });

    return this.mapAcceptance(row);
  }

  async findAcceptanceByOrderId(orderId: string): Promise<OrderLegalAcceptance | null> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "OrderLegalAcceptance" WHERE "orderId" = $orderId`)
      .get({ $orderId: orderId })) as unknown as OrderLegalAcceptanceRow | undefined;
    return row ? this.mapAcceptance(row) : null;
  }

  /**
   * Enforcement gate called from OrdersService BEFORE PENDING_PAYMENT →
   * PENDING_CONFIRMATION transition. Throws BadRequestException if the
   * order does not have a recorded acceptance row.
   */
  async ensureAcceptanceForConfirmation(orderId: string): Promise<void> {
    const acceptance = await this.findAcceptanceByOrderId(orderId);
    if (!acceptance) {
      throw new BadRequestException(
        'Order legal acceptance is required before the order can be confirmed. ' +
          'Customer must accept the distance-sales contract and pre-information form first.',
      );
    }
  }

  // ===================================================================
  // 8. MarketingConsent — append-only
  // ===================================================================

  async upsertMarketingConsent(
    subject: { type: MarketingConsentSubjectType; customerAccountId?: string; tenantAccountId?: string },
    dto: UpsertMarketingConsentDto,
    context: AcceptanceContext,
  ): Promise<MarketingConsent[]> {
    if (subject.type === 'customer' && !subject.customerAccountId) {
      throw new BadRequestException('customerAccountId required for customer marketing consent.');
    }
    if (subject.type === 'tenant' && !subject.tenantAccountId) {
      throw new BadRequestException('tenantAccountId required for tenant marketing consent.');
    }

    const inserted: MarketingConsent[] = [];
    await this.databaseService.transaction(async () => {
      for (const entry of dto.entries) {
        const row = (await this.databaseService
          .prepare(
            `INSERT INTO "MarketingConsent"
               ("subjectType", "customerAccountId", "tenantAccountId",
                "channel", "action", "source", "ipAddress", "userAgent")
             VALUES ($subjectType, $customerId, $tenantId, $channel,
                     $action, $source, $ip, $ua)
             RETURNING *`,
          )
          .get({
            $subjectType: subject.type,
            $customerId: subject.type === 'customer' ? subject.customerAccountId : null,
            $tenantId: subject.type === 'tenant' ? subject.tenantAccountId : null,
            $channel: entry.channel,
            $action: entry.action,
            $source: entry.source ?? null,
            $ip: context.ipAddress ?? null,
            $ua: context.userAgent ?? null,
          })) as unknown as MarketingConsentRow;
        inserted.push(this.mapMarketingConsent(row));
      }
    });

    await this.auditLogService.log({
      actorType: subject.type,
      actorId: subject.customerAccountId ?? subject.tenantAccountId,
      action: 'marketing_consent_updated',
      entityType: 'marketing_consent',
      entityId: inserted[0]?.id ?? 'batch',
      metadata: {
        entries: dto.entries.map((e) => ({ channel: e.channel, action: e.action })),
      },
    });

    return inserted;
  }

  async getMarketingConsentSnapshot(
    subject: { customerAccountId?: string; tenantAccountId?: string },
  ): Promise<MarketingConsentSnapshot[]> {
    const subjectClause = subject.customerAccountId
      ? `"customerAccountId" = $subjectId`
      : `"tenantAccountId" = $subjectId`;
    const subjectId = subject.customerAccountId ?? subject.tenantAccountId;
    if (!subjectId) {
      return [];
    }

    const rows = (await this.databaseService
      .prepare(
        `SELECT DISTINCT ON ("channel") *
         FROM "MarketingConsent"
         WHERE ${subjectClause}
         ORDER BY "channel", "createdAt" DESC`,
      )
      .all({ $subjectId: subjectId })) as unknown as MarketingConsentRow[];

    const indexed = new Map<MarketingConsentChannel, MarketingConsentRow>();
    for (const row of rows) {
      indexed.set(row.channel, row);
    }

    return MARKETING_CONSENT_CHANNELS.map((channel) => {
      const latest = indexed.get(channel);
      return {
        channel,
        isGranted: latest ? latest.action === 'granted' : false,
        lastChangedAt: latest ? this.toDate(latest.createdAt) : null,
        source: latest?.source ?? null,
        iysReferenceId: latest?.iysReferenceId ?? null,
      };
    });
  }

  // ===================================================================
  // 9. StoreTermsAddendum
  // ===================================================================

  async listStoreAddendumsForOwner(
    storeId: string,
    ownerTenantId: string,
  ): Promise<StoreTermsAddendum[]> {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    return this.listStoreAddendumsRaw(storeId);
  }

  /** Public read — only returns active addendums for customer-facing views. */
  async listActiveStoreAddendumsPublic(
    storeId: string,
  ): Promise<StoreTermsAddendum[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "StoreTermsAddendum"
         WHERE "storeId" = $storeId AND "isActive" = TRUE
         ORDER BY "createdAt" DESC`,
      )
      .all({ $storeId: storeId })) as unknown as StoreTermsAddendumRow[];
    return rows.map((row) => this.mapAddendum(row));
  }

  private async listStoreAddendumsRaw(
    storeId: string,
  ): Promise<StoreTermsAddendum[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "StoreTermsAddendum"
         WHERE "storeId" = $storeId
         ORDER BY "createdAt" DESC`,
      )
      .all({ $storeId: storeId })) as unknown as StoreTermsAddendumRow[];
    return rows.map((row) => this.mapAddendum(row));
  }

  async createStoreAddendum(
    storeId: string,
    ownerTenantId: string,
    dto: UpsertStoreTermsAddendumDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    const parent = await this.databaseService
      .prepare(`SELECT "id" FROM "PlatformLegalDocumentVersion" WHERE "id" = $id`)
      .get({ $id: dto.parentDocumentVersionId });
    if (!parent) {
      throw new BadRequestException('parentDocumentVersionId is unknown.');
    }

    const row = (await this.databaseService
      .prepare(
        `INSERT INTO "StoreTermsAddendum"
           ("storeId", "parentDocumentVersionId", "title", "body",
            "locale", "isActive")
         VALUES ($storeId, $parentVersionId, $title, $body, $locale, $isActive)
         RETURNING *`,
      )
      .get({
        $storeId: storeId,
        $parentVersionId: dto.parentDocumentVersionId,
        $title: dto.title,
        $body: dto.body,
        $locale: dto.locale ?? DEFAULT_LOCALE,
        $isActive: dto.isActive ?? true,
      })) as unknown as StoreTermsAddendumRow;

    await this.auditLogService.log({
      actorType: 'tenant',
      actorId: ownerTenantId,
      action: 'store_terms_addendum_created',
      entityType: 'store_terms_addendum',
      entityId: row.id,
      metadata: { storeId, parentDocumentVersionId: dto.parentDocumentVersionId },
    });

    return this.mapAddendum(row);
  }

  async deactivateStoreAddendum(
    storeId: string,
    addendumId: string,
    ownerTenantId: string,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    const addendum = (await this.databaseService
      .prepare(
        `SELECT * FROM "StoreTermsAddendum"
         WHERE "id" = $id AND "storeId" = $storeId`,
      )
      .get({
        $id: addendumId,
        $storeId: storeId,
      })) as unknown as StoreTermsAddendumRow | undefined;
    if (!addendum) {
      throw new NotFoundException('Addendum not found.');
    }

    await this.databaseService
      .prepare(
        `UPDATE "StoreTermsAddendum"
           SET "isActive" = FALSE, "updatedAt" = NOW()
           WHERE "id" = $id`,
      )
      .run({ $id: addendumId });

    await this.auditLogService.log({
      actorType: 'tenant',
      actorId: ownerTenantId,
      action: 'store_terms_addendum_deactivated',
      entityType: 'store_terms_addendum',
      entityId: addendumId,
      metadata: { storeId },
    });

    return { ok: true };
  }

  // ===================================================================
  // 9b. Store addendum helpers for the legacy StoreLegalDocument migration
  //     (MR-DB-HARDENING-01 Slice 7D). These are data primitives — ownership
  //     (store ↔ tenant) is enforced by the admin caller.
  // ===================================================================

  /**
   * Resolve the current (non-superseded) platform document version id for a
   * legal document type code + locale, using the canonical current-version
   * semantics (supersededAt IS NULL, latest publishedAt). Returns null when no
   * published parent exists — callers MUST surface an actionable error rather
   * than invent a parent version.
   */
  async resolveCurrentParentVersionId(
    code: LegalDocumentTypeCode,
    locale: string = DEFAULT_LOCALE,
  ): Promise<string | null> {
    const row = (await this.databaseService
      .prepare(
        `SELECT v."id" AS "versionId"
         FROM "LegalDocumentType" t
         JOIN "PlatformLegalDocument" d
           ON d."typeId" = t."id" AND d."isActive" = TRUE
         JOIN "PlatformLegalDocumentVersion" v
           ON v."documentId" = d."id"
          AND v."locale" = $locale
          AND v."supersededAt" IS NULL
         WHERE t."code" = $code AND t."isActive" = TRUE
         ORDER BY v."publishedAt" DESC
         LIMIT 1`,
      )
      .get({ $code: code, $locale: locale })) as
      | { versionId: string }
      | undefined;
    return row?.versionId ?? null;
  }

  /**
   * Store addendums joined with their parent document's type code, so admin
   * consumers can group store-scoped legal text by canonical document type.
   */
  async listStoreAddendumsWithTypeCode(
    storeId: string,
  ): Promise<Array<StoreTermsAddendum & { typeCode: LegalDocumentTypeCode | null }>> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT a.*, t."code" AS "typeCode"
         FROM "StoreTermsAddendum" a
         JOIN "PlatformLegalDocumentVersion" v ON v."id" = a."parentDocumentVersionId"
         JOIN "PlatformLegalDocument" d ON d."id" = v."documentId"
         JOIN "LegalDocumentType" t ON t."id" = d."typeId"
         WHERE a."storeId" = $storeId
         ORDER BY a."createdAt" DESC`,
      )
      .all({ $storeId: storeId })) as unknown as Array<
      StoreTermsAddendumRow & { typeCode: LegalDocumentTypeCode | null }
    >;
    return rows.map((row) => ({
      ...this.mapAddendum(row),
      typeCode: row.typeCode ?? null,
    }));
  }

  /**
   * Upsert a store addendum keyed on (storeId, parentDocumentVersionId, locale):
   * updates the matching row if present, otherwise inserts. This prevents
   * duplicate addenda on repeated admin edits without a new DB unique constraint.
   */
  async upsertStoreAddendumForParent(
    storeId: string,
    input: {
      parentDocumentVersionId: string;
      locale: string;
      title: string;
      body: string;
      isActive: boolean;
    },
  ): Promise<StoreTermsAddendum> {
    const existing = (await this.databaseService
      .prepare(
        `SELECT "id" FROM "StoreTermsAddendum"
         WHERE "storeId" = $storeId
           AND "parentDocumentVersionId" = $parentVersionId
           AND "locale" = $locale
         LIMIT 1`,
      )
      .get({
        $storeId: storeId,
        $parentVersionId: input.parentDocumentVersionId,
        $locale: input.locale,
      })) as { id: string } | undefined;

    const row = existing
      ? ((await this.databaseService
          .prepare(
            `UPDATE "StoreTermsAddendum"
               SET "title" = $title, "body" = $body,
                   "isActive" = $isActive, "updatedAt" = NOW()
               WHERE "id" = $id
               RETURNING *`,
          )
          .get({
            $id: existing.id,
            $title: input.title,
            $body: input.body,
            $isActive: input.isActive,
          })) as unknown as StoreTermsAddendumRow)
      : ((await this.databaseService
          .prepare(
            `INSERT INTO "StoreTermsAddendum"
               ("storeId", "parentDocumentVersionId", "title", "body",
                "locale", "isActive")
             VALUES ($storeId, $parentVersionId, $title, $body, $locale, $isActive)
             RETURNING *`,
          )
          .get({
            $storeId: storeId,
            $parentVersionId: input.parentDocumentVersionId,
            $title: input.title,
            $body: input.body,
            $locale: input.locale,
            $isActive: input.isActive,
          })) as unknown as StoreTermsAddendumRow);

    return this.mapAddendum(row);
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async findDocumentTypeById(id: string) {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "LegalDocumentType" WHERE "id" = $id`)
      .get({ $id: id })) as unknown as LegalDocumentTypeRow | undefined;
    return row ? this.mapDocumentType(row) : null;
  }

  private async findDocumentById(id: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT d.*, t."code" AS "typeCode"
         FROM "PlatformLegalDocument" d
         INNER JOIN "LegalDocumentType" t ON t."id" = d."typeId"
         WHERE d."id" = $id`,
      )
      .get({ $id: id })) as unknown as PlatformLegalDocumentRow | undefined;
    return row ?? null;
  }

  private async findCurrentVersion(
    documentId: string,
    locale: string,
  ): Promise<PlatformLegalDocumentVersion | null> {
    const row = (await this.databaseService
      .prepare(
        `SELECT * FROM "PlatformLegalDocumentVersion"
         WHERE "documentId" = $documentId
           AND "locale" = $locale
           AND "supersededAt" IS NULL
         ORDER BY "publishedAt" DESC
         LIMIT 1`,
      )
      .get({
        $documentId: documentId,
        $locale: locale,
      })) as unknown as PlatformLegalDocumentVersionRow | undefined;
    return row ? this.mapVersion(row) : null;
  }

  private async findCurrentVersionsForDocuments(documentIds: string[], locale: string) {
    if (documentIds.length === 0) {
      return new Map<string, PlatformLegalDocumentVersion>();
    }
    const rows = (await this.databaseService
      .prepare(
        `SELECT DISTINCT ON ("documentId") *
         FROM "PlatformLegalDocumentVersion"
         WHERE "documentId" = ANY($ids::uuid[])
           AND "locale" = $locale
           AND "supersededAt" IS NULL
         ORDER BY "documentId", "publishedAt" DESC`,
      )
      .all({
        $ids: documentIds,
        $locale: locale,
      })) as unknown as PlatformLegalDocumentVersionRow[];
    const map = new Map<string, PlatformLegalDocumentVersion>();
    for (const row of rows) {
      map.set(row.documentId, this.mapVersion(row));
    }
    return map;
  }

  private async ensureOwnedStore(storeId: string, ownerTenantId: string) {
    const store = await this.storesService.findOwnedStore(
      storeId,
      ownerTenantId,
    );
    if (!store) {
      throw new ForbiddenException('You can only manage legal addendums for your own stores.');
    }
    return store;
  }

  // ===================================================================
  // Row mappers
  // ===================================================================

  private mapDocumentType(row: LegalDocumentTypeRow): LegalDocumentType {
    return {
      id: row.id,
      code: row.code,
      displayName: row.displayName,
      sortOrder: row.sortOrder,
      isActive: Boolean(row.isActive),
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
      updatedAt: this.toDate(row.updatedAt) ?? new Date(0),
    };
  }

  private mapDocument(row: PlatformLegalDocumentRow): PlatformLegalDocument {
    return {
      id: row.id,
      typeId: row.typeId,
      typeCode: row.typeCode ?? null,
      code: row.code,
      audience: row.audience,
      isRequired: Boolean(row.isRequired),
      isActive: Boolean(row.isActive),
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
      updatedAt: this.toDate(row.updatedAt) ?? new Date(0),
    };
  }

  private mapVersion(row: PlatformLegalDocumentVersionRow): PlatformLegalDocumentVersion {
    return {
      id: row.id,
      documentId: row.documentId,
      versionLabel: row.versionLabel,
      locale: row.locale,
      title: row.title,
      body: row.body,
      bodyFormat: row.bodyFormat,
      contentHashSha256: row.contentHashSha256,
      effectiveFrom: this.toDate(row.effectiveFrom) ?? new Date(0),
      publishedAt: this.toDate(row.publishedAt) ?? new Date(0),
      supersededAt: this.toDate(row.supersededAt),
      createdByAdminId: row.createdByAdminId,
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
    };
  }

  private mapConsent(row: ConsentEventRow): ConsentEvent {
    return {
      id: row.id,
      subjectType: row.subjectType,
      customerAccountId: row.customerAccountId,
      tenantAccountId: row.tenantAccountId,
      anonymousIdentifier: row.anonymousIdentifier,
      documentVersionId: row.documentVersionId,
      action: row.action,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      channel: row.channel,
      contextRef: row.contextRef,
      acceptedAt: this.toDate(row.acceptedAt) ?? new Date(0),
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
    };
  }

  private mapAcceptance(row: OrderLegalAcceptanceRow): OrderLegalAcceptance {
    return {
      id: row.id,
      orderId: row.orderId,
      distanceSalesContractVersionId: row.distanceSalesContractVersionId,
      preInformationFormVersionId: row.preInformationFormVersionId,
      acceptedAt: this.toDate(row.acceptedAt) ?? new Date(0),
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
    };
  }

  private mapMarketingConsent(row: MarketingConsentRow): MarketingConsent {
    return {
      id: row.id,
      subjectType: row.subjectType,
      customerAccountId: row.customerAccountId,
      tenantAccountId: row.tenantAccountId,
      channel: row.channel,
      action: row.action,
      source: row.source,
      iysReferenceId: row.iysReferenceId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
    };
  }

  private mapAddendum(row: StoreTermsAddendumRow): StoreTermsAddendum {
    return {
      id: row.id,
      storeId: row.storeId,
      parentDocumentVersionId: row.parentDocumentVersionId,
      title: row.title,
      body: row.body,
      locale: row.locale,
      isActive: Boolean(row.isActive),
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
      updatedAt: this.toDate(row.updatedAt) ?? new Date(0),
    };
  }

  private toDate(value: string | Date | null | undefined): Date | null {
    if (value === null || value === undefined) return null;
    return value instanceof Date ? value : new Date(value);
  }
}
