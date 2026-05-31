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

    it('rejects a superseded (non-current) version id', async () => {
      const { service, prepare } = createService();
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
          {
            id: validDto.distanceSalesContractVersionId,
            code: 'distance_sales_contract',
            supersededAt: '2026-05-01T00:00:00.000Z',
          },
          {
            id: validDto.preInformationFormVersionId,
            code: 'pre_information_form',
            supersededAt: null,
          },
        ]),
      };

      (prepare as jest.Mock)
        .mockImplementationOnce(() => orderLookup as any)
        .mockImplementationOnce(() => existingLookup as any)
        .mockImplementationOnce(() => versionLookup as any);

      await expect(
        service.createOrderLegalAcceptance('customer-1', validDto, context),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects version ids that map to the wrong document type', async () => {
      const { service, prepare } = createService();
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
          {
            id: validDto.distanceSalesContractVersionId,
            code: 'privacy_policy',
            supersededAt: null,
          },
          {
            id: validDto.preInformationFormVersionId,
            code: 'pre_information_form',
            supersededAt: null,
          },
        ]),
      };

      (prepare as jest.Mock)
        .mockImplementationOnce(() => orderLookup as any)
        .mockImplementationOnce(() => existingLookup as any)
        .mockImplementationOnce(() => versionLookup as any);

      await expect(
        service.createOrderLegalAcceptance('customer-1', validDto, context),
      ).rejects.toBeInstanceOf(BadRequestException);
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

  // ===================================================================
  // getCheckoutLegalReadiness — platform-level checkout legal gate
  // ===================================================================

  describe('getCheckoutLegalReadiness', () => {
    function docBundle(
      typeCode: string,
      hasCurrent: boolean,
    ): any {
      return {
        id: `d-${typeCode}`,
        typeId: `t-${typeCode}`,
        typeCode,
        code: `platform-${typeCode}`,
        audience: 'customer',
        isRequired: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentVersion: hasCurrent
          ? {
              id: `v-${typeCode}`,
              documentId: `d-${typeCode}`,
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
            }
          : null,
      };
    }

    it('returns both codes missing when no required documents are published', async () => {
      const { service } = createService();
      jest.spyOn(service, 'listDocuments').mockResolvedValue([]);

      const result = await service.getCheckoutLegalReadiness();

      expect(result.legalReady).toBe(false);
      expect(result.missingLegalDocuments).toEqual([
        'distance_sales_contract',
        'pre_information_form',
      ]);
    });

    it('returns only the unpublished code as missing', async () => {
      const { service } = createService();
      jest.spyOn(service, 'listDocuments').mockResolvedValue([
        docBundle('distance_sales_contract', true),
        docBundle('pre_information_form', false),
      ]);

      const result = await service.getCheckoutLegalReadiness();

      expect(result.legalReady).toBe(false);
      expect(result.missingLegalDocuments).toEqual(['pre_information_form']);
    });

    it('is legalReady when both required documents have a current version', async () => {
      const { service } = createService();
      jest.spyOn(service, 'listDocuments').mockResolvedValue([
        docBundle('distance_sales_contract', true),
        docBundle('pre_information_form', true),
      ]);

      const result = await service.getCheckoutLegalReadiness();

      expect(result.legalReady).toBe(true);
      expect(result.missingLegalDocuments).toEqual([]);
    });

    it('treats a document without a current version (draft/superseded) as missing', async () => {
      const { service } = createService();
      jest.spyOn(service, 'listDocuments').mockResolvedValue([
        docBundle('distance_sales_contract', false),
        docBundle('pre_information_form', true),
      ]);

      const result = await service.getCheckoutLegalReadiness();

      expect(result.legalReady).toBe(false);
      expect(result.missingLegalDocuments).toEqual(['distance_sales_contract']);
    });

    // -----------------------------------------------------------------
    // Placeholder content guard (MR-CHECKOUT-LEGAL-PLACEHOLDER-GUARD-01).
    // Enforced only in production; toggled via NODE_ENV here.
    // -----------------------------------------------------------------
    describe('placeholder content guard (production)', () => {
      const originalEnv = { ...process.env };

      afterEach(() => {
        for (const key of Object.keys(process.env)) {
          if (!(key in originalEnv)) delete process.env[key];
        }
        Object.assign(process.env, originalEnv);
      });

      function placeholderBundle(typeCode: string): any {
        const bundle = docBundle(typeCode, true);
        bundle.currentVersion.title = `${typeCode} (taslak)`;
        bundle.currentVersion.body = 'Lorem ipsum — üretime geçmeden önce doğrulayın.';
        return bundle;
      }

      it('marks a required doc with placeholder content as NOT ready in production', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
        const { service } = createService();
        jest.spyOn(service, 'listDocuments').mockResolvedValue([
          placeholderBundle('distance_sales_contract'),
          docBundle('pre_information_form', true),
        ]);

        const result = await service.getCheckoutLegalReadiness();

        expect(result.legalReady).toBe(false);
        expect(result.placeholderLegalDocuments).toEqual(['distance_sales_contract']);
        expect(result.missingLegalDocuments).toContain('distance_sales_contract');
      });

      it('flags pre_information_form placeholder content too', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
        const { service } = createService();
        jest.spyOn(service, 'listDocuments').mockResolvedValue([
          docBundle('distance_sales_contract', true),
          placeholderBundle('pre_information_form'),
        ]);

        const result = await service.getCheckoutLegalReadiness();

        expect(result.legalReady).toBe(false);
        expect(result.placeholderLegalDocuments).toEqual(['pre_information_form']);
      });

      it('stays ready in production when content is clean', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
        const { service } = createService();
        jest.spyOn(service, 'listDocuments').mockResolvedValue([
          docBundle('distance_sales_contract', true),
          docBundle('pre_information_form', true),
        ]);

        const result = await service.getCheckoutLegalReadiness();

        expect(result.legalReady).toBe(true);
        expect(result.placeholderLegalDocuments).toEqual([]);
      });

      it('does not block placeholder content outside production (dev/test parity)', async () => {
        process.env.NODE_ENV = 'development';
        delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
        const { service } = createService();
        jest.spyOn(service, 'listDocuments').mockResolvedValue([
          placeholderBundle('distance_sales_contract'),
          placeholderBundle('pre_information_form'),
        ]);

        const result = await service.getCheckoutLegalReadiness();

        expect(result.legalReady).toBe(true);
        expect(result.placeholderLegalDocuments).toEqual([]);
      });
    });
  });

  // ===================================================================
  // publishVersion — production placeholder publish guard
  // ===================================================================

  describe('publishVersion placeholder guard', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) delete process.env[key];
      }
      Object.assign(process.env, originalEnv);
    });

    const placeholderDto = {
      versionLabel: 'v1',
      locale: 'tr',
      title: 'Mesafeli Satış Sözleşmesi (taslak)',
      body: 'Lorem ipsum — hukuk ekibi tarafından doğrulanmalıdır.',
    } as any;

    function mockDocFound(prepare: jest.Mock) {
      // 1) findDocumentById → return a document header
      // 2) labelClash lookup → no clash
      prepare
        .mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            id: 'doc-1',
            typeId: 'type-1',
            typeCode: 'distance_sales_contract',
            code: 'platform-distance',
            audience: 'customer',
            isRequired: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          all: jest.fn(),
          run: jest.fn(),
        }))
        .mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue(undefined),
          all: jest.fn(),
          run: jest.fn(),
        }));
    }

    it('blocks publishing placeholder content in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
      const { service, prepare, databaseService } = createService();
      mockDocFound(prepare as jest.Mock);

      await expect(
        service.publishVersion('doc-1', placeholderDto, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Guard fires before the insert transaction runs.
      expect(databaseService.transaction).not.toHaveBeenCalled();
    });

    it('allows placeholder content in production when ALLOW flag is set (bypass)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT = 'true';
      const { service, prepare } = createService();
      mockDocFound(prepare as jest.Mock);
      // findCurrentVersion (supersede lookup) + insert
      (prepare as jest.Mock)
        .mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue(undefined),
          all: jest.fn(),
          run: jest.fn(),
        }))
        .mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            id: 'ver-new',
            documentId: 'doc-1',
            versionLabel: 'v1',
            locale: 'tr',
            title: placeholderDto.title,
            body: placeholderDto.body,
            bodyFormat: 'markdown',
            contentHashSha256: 'h',
            effectiveFrom: new Date(),
            publishedAt: new Date(),
            supersededAt: null,
            createdByAdminId: 'admin-1',
            createdAt: new Date(),
          }),
          all: jest.fn(),
          run: jest.fn(),
        }));

      const result = await service.publishVersion('doc-1', placeholderDto, 'admin-1');
      expect(result.id).toBe('ver-new');
    });
  });
});
