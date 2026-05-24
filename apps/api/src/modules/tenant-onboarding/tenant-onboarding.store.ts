// bu dosya ne işe yarıyor? 
/* 
Bu dosya, kiracıların (tenants) onboarding sürecini yönetmek için kullanılan bir veri erişim katmanını temsil eder. 
TenantOnboardingStore sınıfı, veritabanı işlemlerini gerçekleştirerek tenant onboarding uygulamaları, adım ilerlemeleri, iş detayları, yasal detaylar, sahip iletişim bilgileri, 
operasyon profilleri, belgeler ve incelemeler gibi çeşitli varlıklarla etkileşim kurar. 
Bu sınıf, uygulama durumunu güncellemek ve sorgulamak için kullanılan yöntemler içerir. 
Veritabanı işlemleri için DatabaseService kullanılır ve her yöntem, ilgili veritabanı sorgularını hazırlayıp çalıştırarak gerekli verileri alır veya günceller.
*/

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CryptoUtil } from '../../common/utility/crypto-util';
import {
  AdminNote,
  TenantApplicationReview,
  TenantBusinessDetail,
  TenantDocument,
  TenantDocumentReview,
  TenantLegalDetail,
  TenantOnboardingApplication,
  TenantOnboardingApplicationStatus,
  TenantOnboardingStepKey,
  TenantOnboardingStepProgress,
  TenantOnboardingStepStatus,
  TenantOperationsProfile,
  TenantOwnerContact,
  tenantOnboardingStepKeys,
} from './entities/tenant-onboarding.entity';

const randomTokenSalt = CryptoUtil.randomTokenSalt;
const isTerminalStatus = CryptoUtil.isTerminalStatus;

@Injectable()
export class TenantOnboardingStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async findApplicationByTenantId(tenantAccountId: string) {
    const row = await this.databaseService
      .prepare(`SELECT * FROM "TenantOnboardingApplication" WHERE "tenantAccountId" = $tenantAccountId`)
      .get({ $tenantAccountId: tenantAccountId }) as ApplicationRow | undefined;
    return row ? this.mapApplication(row) : null;
  }

  async findApplicationById(id: string) {
    const row = await this.databaseService
      .prepare(`SELECT * FROM "TenantOnboardingApplication" WHERE "id" = $id`)
      .get({ $id: id }) as ApplicationRow | undefined;
    return row ? this.mapApplication(row) : null;
  }

  async findTenantAccountByApplicationId(applicationId: string) {
    const row = await this.databaseService.prepare(
      `SELECT p.* FROM "TenantAccount" p
       INNER JOIN "TenantOnboardingApplication" a ON a."tenantAccountId" = p."id"
       WHERE a."id" = $applicationId`,
    ).get({ $applicationId: applicationId }) as TenantAccountLookupRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      phoneNumber: row.phoneNumber,
      companyName: row.companyName,
      companyAddress: row.companyAddress,
      tenantType: row.tenantType,
      deliveryModel: row.deliveryModel,
      verificationStatus: row.verificationStatus,
      onboardingStatus: row.onboardingStatus,
      isActive: Boolean(row.isActive),
      isVerified: Boolean(row.isVerified),
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createApplication(tenantAccountId: string, status: TenantOnboardingApplicationStatus) {
    const application: TenantOnboardingApplication = {
      id: randomUUID(),
      tenantAccountId,
      status,
      submittedAt: null,
      reviewStartedAt: null,
      approvedAt: null,
      rejectedAt: null,
      revisionRequestedAt: null,
      activatedAt: null,
      suspendedAt: null,
      lastSubmittedAt: null,
      currentRevisionNumber: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokenSalt: randomTokenSalt(),
    };

    await this.databaseService.prepare(
      `INSERT INTO "TenantOnboardingApplication" (
        "id","tenantAccountId","status","submittedAt","reviewStartedAt","approvedAt","rejectedAt",
        "revisionRequestedAt","activatedAt","suspendedAt","lastSubmittedAt","currentRevisionNumber","createdAt","updatedAt","tokenSalt"
      ) VALUES (
        $id,$tenantAccountId,$status,$submittedAt,$reviewStartedAt,$approvedAt,$rejectedAt,
        $revisionRequestedAt,$activatedAt,$suspendedAt,$lastSubmittedAt,$currentRevisionNumber,$createdAt,$updatedAt,$tokenSalt
      )`,
    ).run(this.applicationParams(application));

    for (const stepKey of tenantOnboardingStepKeys) {
      await this.upsertStepProgress(application.id, stepKey, 'not_started');
    }

    return application;
  }

  async updateApplicationStatus(applicationId: string, input: Partial<TenantOnboardingApplication>) {
    const existing = await this.findApplicationById(applicationId);
    if (!existing) {
      throw new Error(`Application ${applicationId} not found.`);
    }
    const nextTokenSalt = input.tokenSalt ?? existing.tokenSalt;
    const updated: TenantOnboardingApplication = {
      ...existing,
      ...input,
      tokenSalt: isTerminalStatus(input.status ?? existing.status) ? null : nextTokenSalt,
      updatedAt: new Date(),
    };
    await this.databaseService.prepare(
      `UPDATE "TenantOnboardingApplication"
       SET "status" = $status, "submittedAt" = $submittedAt, "reviewStartedAt" = $reviewStartedAt,
           "approvedAt" = $approvedAt, "rejectedAt" = $rejectedAt, "revisionRequestedAt" = $revisionRequestedAt,
           "activatedAt" = $activatedAt, "suspendedAt" = $suspendedAt, "lastSubmittedAt" = $lastSubmittedAt,
           "currentRevisionNumber" = $currentRevisionNumber, "updatedAt" = $updatedAt, "tokenSalt" = $tokenSalt
       WHERE "id" = $id`,
    ).run(this.applicationParams(updated));
    return updated;
  }

  async listStepProgress(applicationId: string) {
    const rows = await this.databaseService
      .prepare(`SELECT * FROM "TenantOnboardingStepProgress" WHERE "applicationId" = $applicationId ORDER BY "createdAt" ASC`)
      .all({ $applicationId: applicationId }) as StepRow[];
    return rows.map((row) => this.mapStep(row));
  }

  async upsertStepProgress(applicationId: string, stepKey: TenantOnboardingStepKey, status: TenantOnboardingStepStatus, blockedReason?: string | null) {
    const existing = await this.databaseService
      .prepare(`SELECT * FROM "TenantOnboardingStepProgress" WHERE "applicationId" = $applicationId AND "stepKey" = $stepKey`)
      .get({ $applicationId: applicationId, $stepKey: stepKey }) as StepRow | undefined;
    const now = new Date();

    if (!existing) {
      const created: TenantOnboardingStepProgress = {
        id: randomUUID(),
        applicationId,
        stepKey,
        status,
        completedAt: status === 'completed' ? now : null,
        blockedReason: blockedReason ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await this.databaseService.prepare(
        `INSERT INTO "TenantOnboardingStepProgress" (
          "id","applicationId","stepKey","status","completedAt","blockedReason","createdAt","updatedAt"
        ) VALUES (
          $id,$applicationId,$stepKey,$status,$completedAt,$blockedReason,$createdAt,$updatedAt
        )`,
      ).run({
        $id: created.id,
        $applicationId: created.applicationId,
        $stepKey: created.stepKey,
        $status: created.status,
        $completedAt: created.completedAt?.toISOString() ?? null,
        $blockedReason: created.blockedReason,
        $createdAt: created.createdAt.toISOString(),
        $updatedAt: created.updatedAt.toISOString(),
      });
      return created;
    }

    const updated = {
      ...this.mapStep(existing),
      status,
      blockedReason: blockedReason ?? null,
      completedAt: status === 'completed' ? existing.completedAt ? new Date(existing.completedAt) : now : null,
      updatedAt: now,
    };
    await this.databaseService.prepare(
      `UPDATE "TenantOnboardingStepProgress"
       SET "status" = $status, "completedAt" = $completedAt, "blockedReason" = $blockedReason, "updatedAt" = $updatedAt
       WHERE "id" = $id`,
    ).run({
      $id: updated.id,
      $status: updated.status,
      $completedAt: updated.completedAt?.toISOString() ?? null,
      $blockedReason: updated.blockedReason,
      $updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  async upsertBusinessDetail(applicationId: string, input: Omit<TenantBusinessDetail, 'id' | 'applicationId' | 'createdAt' | 'updatedAt'>) {
    const existing = await this.getBusinessDetail(applicationId);
    if (!existing) {
      const created: TenantBusinessDetail = { id: randomUUID(), applicationId, ...input, createdAt: new Date(), updatedAt: new Date() };
      await this.databaseService.prepare(
        `INSERT INTO "TenantBusinessDetail" (
          "id","applicationId","businessName","businessType","registrationNumber","taxNumber","addressLine1",
          "addressLine2","city","postalCode","country","createdAt","updatedAt"
        ) VALUES (
          $id,$applicationId,$businessName,$businessType,$registrationNumber,$taxNumber,$addressLine1,
          $addressLine2,$city,$postalCode,$country,$createdAt,$updatedAt
        )`,
      ).run(this.businessParams(created));
      return created;
    }
    const updated = { ...existing, ...input, updatedAt: new Date() };
    await this.databaseService.prepare(
      `UPDATE "TenantBusinessDetail"
       SET "businessName" = $businessName, "businessType" = $businessType, "registrationNumber" = $registrationNumber,
           "taxNumber" = $taxNumber, "addressLine1" = $addressLine1, "addressLine2" = $addressLine2,
           "city" = $city, "postalCode" = $postalCode, "country" = $country, "updatedAt" = $updatedAt
       WHERE "applicationId" = $applicationId`,
    ).run(this.businessParams(updated));
    return updated;
  }

  async getBusinessDetail(applicationId: string) {
    const row = await this.databaseService.prepare(`SELECT * FROM "TenantBusinessDetail" WHERE "applicationId" = $applicationId`).get({ $applicationId: applicationId }) as BusinessRow | undefined;
    return row ? this.mapBusiness(row) : null;
  }

  async upsertLegalDetail(applicationId: string, input: Omit<TenantLegalDetail, 'id' | 'applicationId' | 'createdAt' | 'updatedAt'>) {
    const existing = await this.getLegalDetail(applicationId);
    if (!existing) {
      const created: TenantLegalDetail = { id: randomUUID(), applicationId, ...input, createdAt: new Date(), updatedAt: new Date() };
      await this.databaseService.prepare(
        `INSERT INTO "TenantLegalDetail" (
          "id","applicationId","legalEntityName","taxId","vatId","registrationCountry","registeredAddress","createdAt","updatedAt"
        ) VALUES (
          $id,$applicationId,$legalEntityName,$taxId,$vatId,$registrationCountry,$registeredAddress,$createdAt,$updatedAt
        )`,
      ).run(this.legalParams(created));
      return created;
    }
    const updated = { ...existing, ...input, updatedAt: new Date() };
    await this.databaseService.prepare(
      `UPDATE "TenantLegalDetail"
       SET "legalEntityName" = $legalEntityName, "taxId" = $taxId, "vatId" = $vatId,
           "registrationCountry" = $registrationCountry, "registeredAddress" = $registeredAddress, "updatedAt" = $updatedAt
       WHERE "applicationId" = $applicationId`,
    ).run(this.legalParams(updated));
    return updated;
  }

  async getLegalDetail(applicationId: string) {
    const row = await this.databaseService.prepare(`SELECT * FROM "TenantLegalDetail" WHERE "applicationId" = $applicationId`).get({ $applicationId: applicationId }) as LegalRow | undefined;
    return row ? this.mapLegal(row) : null;
  }

  async upsertOwnerContact(applicationId: string, input: Omit<TenantOwnerContact, 'id' | 'applicationId' | 'createdAt' | 'updatedAt'>) {
    const existing = await this.getOwnerContact(applicationId);
    if (!existing) {
      const created: TenantOwnerContact = { id: randomUUID(), applicationId, ...input, createdAt: new Date(), updatedAt: new Date() };
      await this.databaseService.prepare(
        `INSERT INTO "TenantOwnerContact" (
          "id","applicationId","fullName","email","phoneNumber","roleTitle","ownershipPercentage","createdAt","updatedAt"
        ) VALUES (
          $id,$applicationId,$fullName,$email,$phoneNumber,$roleTitle,$ownershipPercentage,$createdAt,$updatedAt
        )`,
      ).run(this.ownerParams(created));
      return created;
    }
    const updated = { ...existing, ...input, updatedAt: new Date() };
    await this.databaseService.prepare(
      `UPDATE "TenantOwnerContact"
       SET "fullName" = $fullName, "email" = $email, "phoneNumber" = $phoneNumber, "roleTitle" = $roleTitle,
           "ownershipPercentage" = $ownershipPercentage, "updatedAt" = $updatedAt
       WHERE "applicationId" = $applicationId`,
    ).run(this.ownerParams(updated));
    return updated;
  }

  async getOwnerContact(applicationId: string) {
    const row = await this.databaseService.prepare(`SELECT * FROM "TenantOwnerContact" WHERE "applicationId" = $applicationId`).get({ $applicationId: applicationId }) as OwnerRow | undefined;
    return row ? this.mapOwner(row) : null;
  }

  async upsertOperationsProfile(applicationId: string, input: Omit<TenantOperationsProfile, 'id' | 'applicationId' | 'createdAt' | 'updatedAt'>) {
    const existing = await this.getOperationsProfile(applicationId);
    if (!existing) {
      const created: TenantOperationsProfile = { id: randomUUID(), applicationId, ...input, createdAt: new Date(), updatedAt: new Date() };
      await this.databaseService.prepare(
        `INSERT INTO "TenantOperationsProfile" (
          "id","applicationId","primaryCity","primaryPostalCode","deliveryModel","supportsPickup","openingHoursSummary",
          "estimatedGoLiveDate","createdAt","updatedAt"
        ) VALUES (
          $id,$applicationId,$primaryCity,$primaryPostalCode,$deliveryModel,$supportsPickup,$openingHoursSummary,
          $estimatedGoLiveDate,$createdAt,$updatedAt
        )`,
      ).run(this.operationsParams(created));
      return created;
    }
    const updated = { ...existing, ...input, updatedAt: new Date() };
    await this.databaseService.prepare(
      `UPDATE "TenantOperationsProfile"
       SET "primaryCity" = $primaryCity, "primaryPostalCode" = $primaryPostalCode, "deliveryModel" = $deliveryModel,
           "supportsPickup" = $supportsPickup, "openingHoursSummary" = $openingHoursSummary,
           "estimatedGoLiveDate" = $estimatedGoLiveDate, "updatedAt" = $updatedAt
       WHERE "applicationId" = $applicationId`,
    ).run(this.operationsParams(updated));
    return updated;
  }

  async getOperationsProfile(applicationId: string) {
    const row = await this.databaseService.prepare(`SELECT * FROM "TenantOperationsProfile" WHERE "applicationId" = $applicationId`).get({ $applicationId: applicationId }) as OperationsRow | undefined;
    return row ? this.mapOperations(row) : null;
  }

  async markDocumentsNotCurrent(applicationId: string, type: string) {
    await this.databaseService.prepare(
      `UPDATE "TenantDocument" SET "isCurrent" = FALSE, "updatedAt" = $updatedAt WHERE "applicationId" = $applicationId AND "type" = $type AND "isCurrent" = TRUE`,
    ).run({
      $applicationId: applicationId,
      $type: type,
      $updatedAt: new Date().toISOString(),
    });
  }

  async getLatestDocumentVersion(applicationId: string, type: string) {
    const row = await this.databaseService.prepare(
      `SELECT MAX("version") as "version" FROM "TenantDocument" WHERE "applicationId" = $applicationId AND "type" = $type`,
    ).get({ $applicationId: applicationId, $type: type }) as { version: number | null } | undefined;
    return Number(row?.version ?? 0);
  }

  async createDocument(input: Omit<TenantDocument, 'id' | 'createdAt' | 'updatedAt'>) {
    const document: TenantDocument = { ...input, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
    await this.databaseService.prepare(
      `INSERT INTO "TenantDocument" (
        "id","applicationId","fileAssetId","type","status","isRequired","version","isCurrent","uploadedAt","reviewedAt",
        "reviewedByAdminId","rejectionReason","expiresAt","createdAt","updatedAt"
      ) VALUES (
        $id,$applicationId,$fileAssetId,$type,$status,$isRequired,$version,$isCurrent,$uploadedAt,$reviewedAt,
        $reviewedByAdminId,$rejectionReason,$expiresAt,$createdAt,$updatedAt
      )`,
    ).run(this.documentParams(document));
    return document;
  }

  async listDocuments(applicationId: string) {
    const rows = await this.databaseService.prepare(`SELECT * FROM "TenantDocument" WHERE "applicationId" = $applicationId ORDER BY "uploadedAt" DESC`).all({ $applicationId: applicationId }) as DocumentRow[];
    return rows.map((row) => this.mapDocument(row));
  }

  async listAllCurrentDocuments() {
    const rows = await this.databaseService.prepare(
      `SELECT d.* FROM "TenantDocument" d
       WHERE d."isCurrent" = TRUE
       ORDER BY d."uploadedAt" DESC`,
    ).all() as DocumentRow[];
    return rows.map((row) => this.mapDocument(row));
  }

  async findDocumentById(id: string) {
    const row = await this.databaseService.prepare(`SELECT * FROM "TenantDocument" WHERE "id" = $id`).get({ $id: id }) as DocumentRow | undefined;
    return row ? this.mapDocument(row) : null;
  }

  async updateDocumentStatus(documentId: string, input: Pick<TenantDocument, 'status' | 'reviewedAt' | 'reviewedByAdminId' | 'rejectionReason' | 'expiresAt'>) {
    const existing = await this.findDocumentById(documentId);
    if (!existing) {
      throw new Error(`Document ${documentId} not found.`);
    }
    const updated = { ...existing, ...input, updatedAt: new Date() };
    await this.databaseService.prepare(
      `UPDATE "TenantDocument"
       SET "status" = $status, "reviewedAt" = $reviewedAt, "reviewedByAdminId" = $reviewedByAdminId,
           "rejectionReason" = $rejectionReason, "expiresAt" = $expiresAt, "updatedAt" = $updatedAt
       WHERE "id" = $id`,
    ).run(this.documentParams(updated));
    return updated;
  }

  async createDocumentReview(input: Omit<TenantDocumentReview, 'id' | 'createdAt'>) {
    const review: TenantDocumentReview = { ...input, id: randomUUID(), createdAt: new Date() };
    await this.databaseService.prepare(
      `INSERT INTO "TenantDocumentReview" ("id","documentId","adminId","decision","note","createdAt")
       VALUES ($id,$documentId,$adminId,$decision,$note,$createdAt)`,
    ).run({
      $id: review.id,
      $documentId: review.documentId,
      $adminId: review.adminId,
      $decision: review.decision,
      $note: review.note,
      $createdAt: review.createdAt.toISOString(),
    });
    return review;
  }

  async createApplicationReview(input: Omit<TenantApplicationReview, 'id' | 'createdAt'>) {
    const review: TenantApplicationReview = { ...input, id: randomUUID(), createdAt: new Date() };
    await this.databaseService.prepare(
      `INSERT INTO "TenantApplicationReview" ("id","applicationId","adminId","decision","internalNote","tenantVisibleNote","createdAt")
       VALUES ($id,$applicationId,$adminId,$decision,$internalNote,$tenantVisibleNote,$createdAt)`,
    ).run({
      $id: review.id,
      $applicationId: review.applicationId,
      $adminId: review.adminId,
      $decision: review.decision,
      $internalNote: review.internalNote,
      $tenantVisibleNote: review.tenantVisibleNote,
      $createdAt: review.createdAt.toISOString(),
    });
    return review;
  }

  async listApplicationReviews(applicationId: string) {
    const rows = await this.databaseService.prepare(`SELECT * FROM "TenantApplicationReview" WHERE "applicationId" = $applicationId ORDER BY "createdAt" DESC`).all({ $applicationId: applicationId }) as ApplicationReviewRow[];
    return rows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      adminId: row.adminId,
      decision: row.decision as TenantApplicationReview['decision'],
      internalNote: row.internalNote,
      tenantVisibleNote: row.tenantVisibleNote,
      createdAt: new Date(row.createdAt),
    }));
  }

  async listDocumentReviewsByApplication(applicationId: string) {
    const rows = await this.databaseService.prepare(
      `SELECT r.* FROM "TenantDocumentReview" r
       INNER JOIN "TenantDocument" d ON d."id" = r."documentId"
       WHERE d."applicationId" = $applicationId
       ORDER BY r."createdAt" DESC`,
    ).all({ $applicationId: applicationId }) as DocumentReviewRow[];
    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      adminId: row.adminId,
      decision: row.decision as TenantDocumentReview['decision'],
      note: row.note,
      createdAt: new Date(row.createdAt),
    }));
  }

  async createAdminNote(input: Omit<AdminNote, 'id' | 'createdAt'>) {
    const note: AdminNote = { ...input, id: randomUUID(), createdAt: new Date() };
    await this.databaseService.prepare(
      `INSERT INTO "AdminNote" ("id","applicationId","adminId","scope","body","createdAt")
       VALUES ($id,$applicationId,$adminId,$scope,$body,$createdAt)`,
    ).run({
      $id: note.id,
      $applicationId: note.applicationId,
      $adminId: note.adminId,
      $scope: note.scope,
      $body: note.body,
      $createdAt: note.createdAt.toISOString(),
    });
    return note;
  }

  async listAdminNotes(applicationId: string) {
    const rows = await this.databaseService.prepare(`SELECT * FROM "AdminNote" WHERE "applicationId" = $applicationId ORDER BY "createdAt" DESC`).all({ $applicationId: applicationId }) as AdminNoteRow[];
    return rows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      adminId: row.adminId,
      scope: row.scope as AdminNote['scope'],
      body: row.body,
      createdAt: new Date(row.createdAt),
    }));
  }

  async listApplications() {
    const rows = await this.databaseService.prepare(
      `SELECT a.*, p."email" as "tenantEmail", p."companyName" as "tenantCompanyName",
              b."city" as "businessCity", b."businessType" as "businessType"
       FROM "TenantOnboardingApplication" a
       INNER JOIN "TenantAccount" p ON p."id" = a."tenantAccountId"
       LEFT JOIN "TenantBusinessDetail" b ON b."applicationId" = a."id"
       ORDER BY a."updatedAt" DESC`,
    ).all() as (ApplicationRow & { tenantEmail: string; tenantCompanyName: string; businessCity: string | null; businessType: string | null })[];

    return rows.map((row) => ({
      application: this.mapApplication(row),
      tenantEmail: row.tenantEmail,
      tenantCompanyName: row.tenantCompanyName,
      businessCity: row.businessCity,
      businessType: row.businessType,
    }));
  }

  private applicationParams(application: TenantOnboardingApplication) {
    return {
      $id: application.id,
      $tenantAccountId: application.tenantAccountId,
      $status: application.status,
      $submittedAt: application.submittedAt?.toISOString() ?? null,
      $reviewStartedAt: application.reviewStartedAt?.toISOString() ?? null,
      $approvedAt: application.approvedAt?.toISOString() ?? null,
      $rejectedAt: application.rejectedAt?.toISOString() ?? null,
      $revisionRequestedAt: application.revisionRequestedAt?.toISOString() ?? null,
      $activatedAt: application.activatedAt?.toISOString() ?? null,
      $suspendedAt: application.suspendedAt?.toISOString() ?? null,
      $lastSubmittedAt: application.lastSubmittedAt?.toISOString() ?? null,
      $currentRevisionNumber: application.currentRevisionNumber,
      $createdAt: application.createdAt.toISOString(),
      $updatedAt: application.updatedAt.toISOString(),
      $tokenSalt: application.tokenSalt,
    };
  }

  private businessParams(detail: TenantBusinessDetail) {
    return {
      $id: detail.id,
      $applicationId: detail.applicationId,
      $businessName: detail.businessName,
      $businessType: detail.businessType,
      $registrationNumber: detail.registrationNumber,
      $taxNumber: detail.taxNumber,
      $addressLine1: detail.addressLine1,
      $addressLine2: detail.addressLine2,
      $city: detail.city,
      $postalCode: detail.postalCode,
      $country: detail.country,
      $createdAt: detail.createdAt.toISOString(),
      $updatedAt: detail.updatedAt.toISOString(),
    };
  }

  private legalParams(detail: TenantLegalDetail) {
    return {
      $id: detail.id,
      $applicationId: detail.applicationId,
      $legalEntityName: detail.legalEntityName,
      $taxId: detail.taxId,
      $vatId: detail.vatId,
      $registrationCountry: detail.registrationCountry,
      $registeredAddress: detail.registeredAddress,
      $createdAt: detail.createdAt.toISOString(),
      $updatedAt: detail.updatedAt.toISOString(),
    };
  }

  private ownerParams(detail: TenantOwnerContact) {
    return {
      $id: detail.id,
      $applicationId: detail.applicationId,
      $fullName: detail.fullName,
      $email: detail.email,
      $phoneNumber: detail.phoneNumber,
      $roleTitle: detail.roleTitle,
      $ownershipPercentage: detail.ownershipPercentage,
      $createdAt: detail.createdAt.toISOString(),
      $updatedAt: detail.updatedAt.toISOString(),
    };
  }

  private operationsParams(detail: TenantOperationsProfile) {
    return {
      $id: detail.id,
      $applicationId: detail.applicationId,
      $primaryCity: detail.primaryCity,
      $primaryPostalCode: detail.primaryPostalCode,
      $deliveryModel: detail.deliveryModel,
      $supportsPickup: detail.supportsPickup,
      $openingHoursSummary: detail.openingHoursSummary,
      $estimatedGoLiveDate: detail.estimatedGoLiveDate?.toISOString() ?? null,
      $createdAt: detail.createdAt.toISOString(),
      $updatedAt: detail.updatedAt.toISOString(),
    };
  }

  private documentParams(document: TenantDocument) {
    return {
      $id: document.id,
      $applicationId: document.applicationId,
      $fileAssetId: document.fileAssetId,
      $type: document.type,
      $status: document.status,
      $isRequired: document.isRequired,
      $version: document.version,
      $isCurrent: document.isCurrent,
      $uploadedAt: document.uploadedAt.toISOString(),
      $reviewedAt: document.reviewedAt?.toISOString() ?? null,
      $reviewedByAdminId: document.reviewedByAdminId,
      $rejectionReason: document.rejectionReason,
      $expiresAt: document.expiresAt?.toISOString() ?? null,
      $createdAt: document.createdAt.toISOString(),
      $updatedAt: document.updatedAt.toISOString(),
    };
  }

  private mapApplication(row: ApplicationRow): TenantOnboardingApplication {
    return {
      id: row.id,
      tenantAccountId: row.tenantAccountId,
      status: row.status as TenantOnboardingApplicationStatus,
      submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
      reviewStartedAt: row.reviewStartedAt ? new Date(row.reviewStartedAt) : null,
      approvedAt: row.approvedAt ? new Date(row.approvedAt) : null,
      rejectedAt: row.rejectedAt ? new Date(row.rejectedAt) : null,
      revisionRequestedAt: row.revisionRequestedAt ? new Date(row.revisionRequestedAt) : null,
      activatedAt: row.activatedAt ? new Date(row.activatedAt) : null,
      suspendedAt: row.suspendedAt ? new Date(row.suspendedAt) : null,
      lastSubmittedAt: row.lastSubmittedAt ? new Date(row.lastSubmittedAt) : null,
      currentRevisionNumber: Number(row.currentRevisionNumber),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      tokenSalt: row.tokenSalt ?? null,
    };
  }

  private mapStep(row: StepRow): TenantOnboardingStepProgress {
    return {
      id: row.id,
      applicationId: row.applicationId,
      stepKey: row.stepKey as TenantOnboardingStepKey,
      status: row.status as TenantOnboardingStepStatus,
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      blockedReason: row.blockedReason,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapBusiness(row: BusinessRow): TenantBusinessDetail {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapLegal(row: LegalRow): TenantLegalDetail {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapOwner(row: OwnerRow): TenantOwnerContact {
    return {
      ...row,
      ownershipPercentage: row.ownershipPercentage === null ? null : Number(row.ownershipPercentage),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapOperations(row: OperationsRow): TenantOperationsProfile {
    return {
      ...row,
      supportsPickup: Boolean(row.supportsPickup),
      estimatedGoLiveDate: row.estimatedGoLiveDate ? new Date(row.estimatedGoLiveDate) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapDocument(row: DocumentRow): TenantDocument {
    return {
      ...row,
      status: row.status as TenantDocument['status'],
      isRequired: Boolean(row.isRequired),
      version: Number(row.version),
      isCurrent: Boolean(row.isCurrent),
      uploadedAt: new Date(row.uploadedAt),
      reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

interface ApplicationRow { id: string; tenantAccountId: string; status: string; submittedAt: string | null; reviewStartedAt: string | null; approvedAt: string | null; rejectedAt: string | null; revisionRequestedAt: string | null; activatedAt: string | null; suspendedAt: string | null; lastSubmittedAt: string | null; currentRevisionNumber: number; createdAt: string; updatedAt: string; tokenSalt: string | null; }
interface StepRow { id: string; applicationId: string; stepKey: string; status: string; completedAt: string | null; blockedReason: string | null; createdAt: string; updatedAt: string; }
interface BusinessRow { id: string; applicationId: string; businessName: string; businessType: string; registrationNumber: string | null; taxNumber: string | null; addressLine1: string; addressLine2: string | null; city: string; postalCode: string; country: string; createdAt: string; updatedAt: string; }
interface LegalRow { id: string; applicationId: string; legalEntityName: string; taxId: string | null; vatId: string | null; registrationCountry: string; registeredAddress: string; createdAt: string; updatedAt: string; }
interface OwnerRow { id: string; applicationId: string; fullName: string; email: string; phoneNumber: string; roleTitle: string | null; ownershipPercentage: number | null; createdAt: string; updatedAt: string; }
interface OperationsRow { id: string; applicationId: string; primaryCity: string; primaryPostalCode: string; deliveryModel: string; supportsPickup: boolean; openingHoursSummary: string | null; estimatedGoLiveDate: string | null; createdAt: string; updatedAt: string; }
interface DocumentRow { id: string; applicationId: string; fileAssetId: string; type: string; status: string; isRequired: boolean; version: number; isCurrent: boolean; uploadedAt: string; reviewedAt: string | null; reviewedByAdminId: string | null; rejectionReason: string | null; expiresAt: string | null; createdAt: string; updatedAt: string; }
interface ApplicationReviewRow { id: string; applicationId: string; adminId: string; decision: string; internalNote: string | null; tenantVisibleNote: string | null; createdAt: string; }
interface DocumentReviewRow { id: string; documentId: string; adminId: string; decision: string; note: string | null; createdAt: string; }
interface AdminNoteRow { id: string; applicationId: string; adminId: string; scope: string; body: string; createdAt: string; }
interface TenantAccountLookupRow {
  id: string;
  email: string;
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
