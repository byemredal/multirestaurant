import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { CreateLanguageDto } from './dto/create-language.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import {
  Currency,
  Language,
  PaymentMethod,
  ServiceType,
} from './entities/currency.entity';

interface CurrencyRow {
  id: string;
  code: string;
  displayName: string;
  symbol: string;
  numericCode: string | null;
  decimalDigits: number | string;
  sortOrder: number | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LanguageRow {
  id: string;
  code: string;
  displayName: string;
  nativeDisplayName: string;
  sortOrder: number | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaymentMethodRow {
  id: string;
  code: string;
  displayName: string;
  iconKey: string | null;
  sortOrder: number | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ServiceTypeRow extends PaymentMethodRow {}

@Injectable()
export class SystemTaxonomyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listActiveCurrencies(): Promise<Currency[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "Currency"
         WHERE "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "code" ASC`,
      )
      .all({})) as unknown as CurrencyRow[];
    return rows.map((row) => this.mapCurrency(row));
  }

  async listActiveLanguages(): Promise<Language[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "Language"
         WHERE "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "code" ASC`,
      )
      .all({})) as unknown as LanguageRow[];
    return rows.map((row) => this.mapLanguage(row));
  }

  async getCurrencyByIdOrThrow(currencyId: string): Promise<Currency> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Currency" WHERE "id" = $id LIMIT 1`)
      .get({ $id: currencyId })) as CurrencyRow | undefined;
    if (!row) {
      throw new NotFoundException('Currency could not be found.');
    }
    if (!row.isActive) {
      throw new BadRequestException('Currency is inactive and cannot be assigned.');
    }
    return this.mapCurrency(row);
  }

  async getLanguageByIdOrThrow(languageId: string): Promise<Language> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Language" WHERE "id" = $id LIMIT 1`)
      .get({ $id: languageId })) as LanguageRow | undefined;
    if (!row) {
      throw new NotFoundException('Language could not be found.');
    }
    if (!row.isActive) {
      throw new BadRequestException('Language is inactive and cannot be assigned.');
    }
    return this.mapLanguage(row);
  }

  async createCurrency(dto: CreateCurrencyDto): Promise<Currency> {
    const row = (await this.databaseService
      .prepare(
        `INSERT INTO "Currency"
           ("code", "displayName", "symbol", "numericCode", "decimalDigits", "sortOrder", "isActive")
         VALUES ($code, $displayName, $symbol, $numericCode, $decimalDigits, $sortOrder, $isActive)
         RETURNING *`,
      )
      .get({
        $code: dto.code,
        $displayName: dto.displayName.trim(),
        $symbol: dto.symbol.trim(),
        $numericCode: dto.numericCode?.trim() ?? null,
        $decimalDigits: dto.decimalDigits ?? 2,
        $sortOrder: dto.sortOrder ?? 0,
        $isActive: dto.isActive ?? true,
      })) as CurrencyRow;
    return this.mapCurrency(row);
  }

  async listActivePaymentMethods(): Promise<PaymentMethod[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "PaymentMethod"
         WHERE "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "code" ASC`,
      )
      .all({})) as unknown as PaymentMethodRow[];
    return rows.map((row) => this.mapPaymentMethod(row));
  }

  async listActiveServiceTypes(): Promise<ServiceType[]> {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "ServiceType"
         WHERE "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "code" ASC`,
      )
      .all({})) as unknown as ServiceTypeRow[];
    return rows.map((row) => this.mapServiceType(row));
  }

  async getPaymentMethodByIdOrThrow(paymentMethodId: string): Promise<PaymentMethod> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "PaymentMethod" WHERE "id" = $id LIMIT 1`)
      .get({ $id: paymentMethodId })) as PaymentMethodRow | undefined;
    if (!row) {
      throw new NotFoundException('Payment method could not be found.');
    }
    if (!row.isActive) {
      throw new BadRequestException('Payment method is inactive and cannot be assigned.');
    }
    return this.mapPaymentMethod(row);
  }

  async getServiceTypeByIdOrThrow(serviceTypeId: string): Promise<ServiceType> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "ServiceType" WHERE "id" = $id LIMIT 1`)
      .get({ $id: serviceTypeId })) as ServiceTypeRow | undefined;
    if (!row) {
      throw new NotFoundException('Service type could not be found.');
    }
    if (!row.isActive) {
      throw new BadRequestException('Service type is inactive and cannot be assigned.');
    }
    return this.mapServiceType(row);
  }

  async createPaymentMethod(dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const row = (await this.databaseService
      .prepare(
        `INSERT INTO "PaymentMethod"
           ("code", "displayName", "iconKey", "sortOrder", "isActive")
         VALUES ($code, $displayName, $iconKey, $sortOrder, $isActive)
         RETURNING *`,
      )
      .get({
        $code: dto.code,
        $displayName: dto.displayName.trim(),
        $iconKey: dto.iconKey?.trim() ?? null,
        $sortOrder: dto.sortOrder ?? 0,
        $isActive: dto.isActive ?? true,
      })) as PaymentMethodRow;
    return this.mapPaymentMethod(row);
  }

  async createServiceType(dto: CreateServiceTypeDto): Promise<ServiceType> {
    const row = (await this.databaseService
      .prepare(
        `INSERT INTO "ServiceType"
           ("code", "displayName", "iconKey", "sortOrder", "isActive")
         VALUES ($code, $displayName, $iconKey, $sortOrder, $isActive)
         RETURNING *`,
      )
      .get({
        $code: dto.code,
        $displayName: dto.displayName.trim(),
        $iconKey: dto.iconKey?.trim() ?? null,
        $sortOrder: dto.sortOrder ?? 0,
        $isActive: dto.isActive ?? true,
      })) as ServiceTypeRow;
    return this.mapServiceType(row);
  }

  async createLanguage(dto: CreateLanguageDto): Promise<Language> {
    const row = (await this.databaseService
      .prepare(
        `INSERT INTO "Language"
           ("code", "displayName", "nativeDisplayName", "sortOrder", "isActive")
         VALUES ($code, $displayName, $nativeDisplayName, $sortOrder, $isActive)
         RETURNING *`,
      )
      .get({
        $code: dto.code,
        $displayName: dto.displayName.trim(),
        $nativeDisplayName: dto.nativeDisplayName.trim(),
        $sortOrder: dto.sortOrder ?? 0,
        $isActive: dto.isActive ?? true,
      })) as LanguageRow;
    return this.mapLanguage(row);
  }

  private mapCurrency(row: CurrencyRow): Currency {
    return {
      id: row.id,
      code: row.code,
      displayName: row.displayName,
      symbol: row.symbol,
      numericCode: row.numericCode,
      decimalDigits: Number(row.decimalDigits),
      sortOrder: Number(row.sortOrder),
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapLanguage(row: LanguageRow): Language {
    return {
      id: row.id,
      code: row.code,
      displayName: row.displayName,
      nativeDisplayName: row.nativeDisplayName,
      sortOrder: Number(row.sortOrder),
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapPaymentMethod(row: PaymentMethodRow): PaymentMethod {
    return {
      id: row.id,
      code: row.code,
      displayName: row.displayName,
      iconKey: row.iconKey,
      sortOrder: Number(row.sortOrder),
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapServiceType(row: ServiceTypeRow): ServiceType {
    return this.mapPaymentMethod(row);
  }
}
