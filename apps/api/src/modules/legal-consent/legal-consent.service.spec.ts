import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LegalConsentService } from './legal-consent.service';

describe('LegalConsentService', () => {
  type PreparedMock = {
    all: jest.Mock;
    get: jest.Mock;
    run: jest.Mock;
  };

  function createService() {
    const prepareCalls: Array<{ sql: string; prepared: PreparedMock }> = [];

    const prepare = jest.fn((sql: string): PreparedMock => {
      const prepared: PreparedMock = {
        all: jest.fn(),
        get: jest.fn(),
        run: jest.fn().mockResolvedValue({ rows: [] }),
      };
      prepareCalls.push({ sql, prepared });
      return prepared;
    });

    const transaction = jest.fn(async (cb: () => Promise<unknown>) => cb());

    const databaseService = { prepare, transaction } as unknown as any;
    const auditLogService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as any;
    const storesService = { findOwnedStore: jest.fn() } as unknown as any;

    const service = new LegalConsentService(
      databaseService,
      auditLogService,
      storesService,
    );

    function nextPreparedMatching(fragment: string): PreparedMock {
      const found = prepareCalls.find((entry) => entry.sql.includes(fragment));
      if (!found) {
        throw new Error(`No prepared statement matched fragment: ${fragment}`);
      }
      return found.prepared;
    }

    return {
      service,
      databaseService,
      auditLogService,
      storesService,
      prepare,
      prepareCalls,
      nextPreparedMatching,
    };
  }

  // ===================================================================
  // ensureAcceptanceForConfirmation — the legal gate
  // ===================================================================

  describe('ensureAcceptanceForConfirmation', () => {
    it('throws BadRequestException when no OrderLegalAcceptance row exists for the order', async () => {
      const { service, prepare } = createService();
      (prepare as jest.Mock).mockImplementationOnce(() => ({
        get: jest.fn().mockResolvedValue(undefined),
        all: jest.fn(),
        run: jest.fn(),
      }));

      await expect(
        service.ensureAcceptanceForConfirmation('order-without-acceptance'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('passes silently when an acceptance row exists', async () => {
      const { service, prepare } = createService();
      (prepare as jest.Mock).mockImplementationOnce(() => ({
        get: jest.fn().mockResolvedValue({
          id: 'acc-1',
          orderId: 'order-1',
          distanceSalesContractVersionId: 'v-ds-1',
          preInformationFormVersionId: 'v-pi-1',
          acceptedAt: '2026-05-14T10:00:00.000Z',
          ipAddress: null,
          userAgent: null,
          createdAt: '2026-05-14T10:00:00.000Z',
        }),
        all: jest.fn(),
        run: jest.fn(),
      }));

      await expect(
        service.ensureAcceptanceForConfirmation('order-1'),
      ).resolves.toBeUndefined();
    });
  });

  // ===================================================================
  // createOrderLegalAcceptance
  // ===================================================================

  describe('createOrderLegalAcceptance', () => {
    const validDto = {
      orderId: 'order-1',
      distanceSalesContractVersionId: '11111111-1111-4111-8111-111111111111',
      preInformationFormVersionId: '22222222-2222-4222-8222-222222222222',
    };
    const context = { ipAddress: '203.0.113.1', userAgent: 'jest' };

    it('throws NotFoundException when the order does not exist', async () => {
      const { service, prepare } = createService();
      (prepare as jest.Mock).mockImplementationOnce(() => ({
        get: jest.fn().mockResolvedValue(undefined),
        all: jest.fn(),
        run: jest.fn(),
      }));

      await expect(
        service.createOrderLegalAcceptance('customer-1', validDto, context),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the order belongs to a different customer', async () => {
      const { service, prepare } = createService();
      (prepare as jest.Mock).mockImplementationOnce(() => ({
        get: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerAccountId: 'someone-else',
          status: 'pending_payment',
        }),
        all: jest.fn(),
        run: jest.fn(),
      }));

      await expect(
        service.createOrderLegalAcceptance('customer-1', validDto, context),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ConflictException when an acceptance already exists for the order', async () => {
      const { service, prepare } = createService();
      const orderLookup = {
        get: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerAccountId: 'customer-1',
          status: 'pending_payment',
        }),
        all: jest.fn(),
        run: jest.fn(),
      };
      const existingLookup = {
        get: jest.fn().mockResolvedValue({
          id: 'acc-existing',
          orderId: 'order-1',
          distanceSalesContractVersionId: 'v1',
          preInformationFormVersionId: 'v2',
          acceptedAt: '2026-05-14T10:00:00.000Z',
          ipAddress: null,
          userAgent: null,
          createdAt: '2026-05-14T10:00:00.000Z',
        }),
        all: jest.fn(),
        run: jest.fn(),
      };

      (prepare as jest.Mock)
        .mockImplementationOnce(() => orderLookup)
        .mockImplementationOnce(() => existingLookup);

      await expect(
        service.createOrderLegalAcceptance('customer-1', validDto, context),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException when version ids are unknown', async () => {
      const { service, prepare } = createService();
      const orderLookup = {
        get: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerAccountId: 'customer-1',
          status: 'pending_payment',
        }),
      };
      const existingLookup = { get: jest.fn().mockResolvedValue(undefined) };
      const versionLookup = { all: jest.fn().mockResolvedValue([]) };

      (prepare as jest.Mock)
        .mockImplementationOnce(() => orderLookup as any)
        .mockImplementationOnce(() => existingLookup as any)
        .mockImplementationOnce(() => versionLookup as any);

      await expect(
        service.createOrderLegalAcceptance('customer-1', validDto, context),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('inserts an acceptance row and logs to AuditLog on success', async () => {
      const { service, prepare, auditLogService } = createService();
      const insertedRow = {
        id: 'acc-new',
        orderId: 'order-1',
        distanceSalesContractVersionId: validDto.distanceSalesContractVersionId,
        preInformationFormVersionId: validDto.preInformationFormVersionId,
        acceptedAt: '2026-05-14T10:00:00.000Z',
        ipAddress: '203.0.113.1',
        userAgent: 'jest',
        createdAt: '2026-05-14T10:00:00.000Z',
      };

      const orderLookup = {
        get: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerAccountId: 'customer-1',
          status: 'pending_payment',
        }),
      };
      const existingLookup = { get: jest.fn().mockResolvedValue(undefined) };
      const versionLookup = {
        all: jest.fn().mockResolvedValue([
          { id: validDto.distanceSalesContractVersionId, code: 'distance_sales_contract' },
          { id: validDto.preInformationFormVersionId, code: 'pre_information_form' },
        ]),
      };
      const insert = { get: jest.fn().mockResolvedValue(insertedRow) };

      (prepare as jest.Mock)
        .mockImplementationOnce(() => orderLookup as any)
        .mockImplementationOnce(() => existingLookup as any)
        .mockImplementationOnce(() => versionLookup as any)
        .mockImplementationOnce(() => insert as any);

      const result = await service.createOrderLegalAcceptance(
        'customer-1',
        validDto,
        context,
      );

      expect(result.id).toBe('acc-new');
      expect(result.orderId).toBe('order-1');
      expect(insert.get).toHaveBeenCalledTimes(1);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'customer',
          actorId: 'customer-1',
          action: 'order_legal_acceptance_created',
          entityType: 'order_legal_acceptance',
          entityId: 'acc-new',
        }),
      );
    });
  });

  // ===================================================================
  // recordConsent subject validation
  // ===================================================================

  describe('recordConsent — subject validation', () => {
    const baseDto = {
      channel: 'web' as const,
      entries: [
        { documentVersionId: '11111111-1111-4111-8111-111111111111' },
      ],
    };
    const context = { ipAddress: null, userAgent: null };

    it('rejects customer subject without customerAccountId', async () => {
      const { service } = createService();
      await expect(
        service.recordConsent(
          { type: 'customer', customerAccountId: null, tenantAccountId: null },
          baseDto,
          context,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects tenant subject without tenantAccountId', async () => {
      const { service } = createService();
      await expect(
        service.recordConsent(
          { type: 'tenant', customerAccountId: null, tenantAccountId: null },
          baseDto,
          context,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects anonymous subject without anonymousIdentifier', async () => {
      const { service } = createService();
      await expect(
        service.recordConsent(
          {
            type: 'anonymous',
            customerAccountId: null,
            tenantAccountId: null,
            anonymousIdentifier: null,
          },
          baseDto,
          context,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown documentVersionId values', async () => {
      const { service, prepare } = createService();
      // versionRows lookup returns empty -> "unknown"
      (prepare as jest.Mock).mockImplementationOnce(
        () => ({ all: jest.fn().mockResolvedValue([]) }) as any,
      );

      await expect(
        service.recordConsent(
          { type: 'customer', customerAccountId: 'c-1' },
          baseDto,
          context,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('inserts a row per entry and writes a single audit log batch', async () => {
      const { service, prepare, auditLogService } = createService();

      const versionId = '11111111-1111-4111-8111-111111111111';
      const versionLookup = {
        all: jest.fn().mockResolvedValue([
          {
            id: versionId,
            documentId: 'd-1',
            versionLabel: 'v1',
            locale: 'tr',
            title: 't',
            body: 'b',
            bodyFormat: 'markdown',
            contentHashSha256: 'h',
            effectiveFrom: '2026-05-01',
            publishedAt: '2026-05-01',
            supersededAt: null,
            createdByAdminId: null,
            createdAt: '2026-05-01',
            documentIsActive: true,
          },
        ]),
      };
      const insert = {
        get: jest.fn().mockResolvedValue({
          id: 'ce-1',
          subjectType: 'customer',
          customerAccountId: 'c-1',
          tenantAccountId: null,
          anonymousIdentifier: null,
          documentVersionId: versionId,
          action: 'granted',
          ipAddress: null,
          userAgent: null,
          channel: 'web',
          contextRef: null,
          acceptedAt: '2026-05-14T10:00:00.000Z',
          createdAt: '2026-05-14T10:00:00.000Z',
        }),
      };

      (prepare as jest.Mock)
        .mockImplementationOnce(() => versionLookup as any)
        .mockImplementationOnce(() => insert as any);

      const result = await service.recordConsent(
        { type: 'customer', customerAccountId: 'c-1' },
        baseDto,
        context,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('ce-1');
      expect(auditLogService.log).toHaveBeenCalledTimes(1);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consent_event_recorded',
          entityType: 'consent_event',
          entityId: 'ce-1',
        }),
      );
    });
  });

  // ===================================================================
  // requiresReConsent
  // ===================================================================

  describe('requiresReConsent', () => {
    it('returns missing codes when at least one required document has not been accepted in its latest version', async () => {
      const { service } = createService();

      jest.spyOn(service, 'listDocuments').mockResolvedValue([
        {
          id: 'd-1',
          typeId: 't-1',
          typeCode: 'terms_of_service',
          code: 'platform-terms',
          audience: 'customer',
          isRequired: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentVersion: {
            id: 'v-1',
            documentId: 'd-1',
            versionLabel: 'v1',
            locale: 'tr',
            title: 'T',
            body: 'B',
            bodyFormat: 'markdown',
            contentHashSha256: 'h',
            effectiveFrom: new Date(),
            publishedAt: new Date(),
            supersededAt: null,
            createdByAdminId: null,
            createdAt: new Date(),
          },
        },
      ]);

      jest.spyOn(service, 'hasAcceptedLatestVersion').mockResolvedValue(false);

      const result = await service.requiresReConsent('customer', {
        customerAccountId: 'c-1',
      });
      expect(result.requires).toBe(true);
      expect(result.missingDocumentCodes).toEqual(['platform-terms']);
    });

    it('returns no missing codes when all required documents are accepted', async () => {
      const { service } = createService();

      jest.spyOn(service, 'listDocuments').mockResolvedValue([
        {
          id: 'd-1',
          typeId: 't-1',
          typeCode: 'terms_of_service',
          code: 'platform-terms',
          audience: 'customer',
          isRequired: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentVersion: {
            id: 'v-1',
            documentId: 'd-1',
            versionLabel: 'v1',
            locale: 'tr',
            title: 'T',
            body: 'B',
            bodyFormat: 'markdown',
            contentHashSha256: 'h',
            effectiveFrom: new Date(),
            publishedAt: new Date(),
            supersededAt: null,
            createdByAdminId: null,
            createdAt: new Date(),
          },
        },
      ]);

      jest.spyOn(service, 'hasAcceptedLatestVersion').mockResolvedValue(true);

      const result = await service.requiresReConsent('customer', {
        customerAccountId: 'c-1',
      });
      expect(result.requires).toBe(false);
      expect(result.missingDocumentCodes).toEqual([]);
    });

    it('ignores non-required documents', async () => {
      const { service } = createService();

      jest.spyOn(service, 'listDocuments').mockResolvedValue([
        {
          id: 'd-2',
          typeId: 't-2',
          typeCode: 'cookie_policy',
          code: 'platform-cookies',
          audience: 'customer',
          isRequired: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentVersion: {
            id: 'v-2',
            documentId: 'd-2',
            versionLabel: 'v1',
            locale: 'tr',
            title: 'T',
            body: 'B',
            bodyFormat: 'markdown',
            contentHashSha256: 'h',
            effectiveFrom: new Date(),
            publishedAt: new Date(),
            supersededAt: null,
            createdByAdminId: null,
            createdAt: new Date(),
          },
        },
      ]);

      const hasAcceptedSpy = jest.spyOn(service, 'hasAcceptedLatestVersion');

      const result = await service.requiresReConsent('customer', {
        customerAccountId: 'c-1',
      });

      expect(result.requires).toBe(false);
      expect(hasAcceptedSpy).not.toHaveBeenCalled();
    });
  });
});
