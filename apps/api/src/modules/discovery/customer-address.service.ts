import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { InstallationProfileService } from '../setup/installation-profile.service';
import { AddressNormalizationService } from './address-normalization.service';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';

interface CustomerAddressRow {
  id: string;
  customerAccountId: string;
  label: string | null;
  recipientName: string | null;
  contactPhone: string | null;
  countryCode: string;
  canton: string | null;
  city: string;
  postalCode: string;
  street: string | null;
  houseNumber: string | null;
  addressLine2: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
  deliveryNotes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * CRUD for persistent customer delivery addresses. The "one default per
 * customer" rule is enforced by the partial unique index in migration 0017;
 * this service simply unsets the previous default before promoting a new one.
 */
@Injectable()
export class CustomerAddressService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly addressNormalization: AddressNormalizationService,
    private readonly installationProfile: InstallationProfileService,
  ) {}

  /** Active platform country, or undefined pre-setup. */
  private async platformCountry(): Promise<string | undefined> {
    const policy = await this.installationProfile.findActiveCountryPolicy();
    return policy?.countryCode;
  }

  async list(customerAccountId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "CustomerAddress"
         WHERE "customerAccountId" = $customerAccountId
         ORDER BY "isDefault" DESC, "createdAt" DESC`,
      )
      .all({ $customerAccountId: customerAccountId })) as unknown as CustomerAddressRow[];
    return { addresses: rows.map((row) => this.mapAddress(row)) };
  }

  async getDefault(customerAccountId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT * FROM "CustomerAddress"
         WHERE "customerAccountId" = $customerAccountId AND "isDefault" = TRUE
         LIMIT 1`,
      )
      .get({ $customerAccountId: customerAccountId })) as CustomerAddressRow | undefined;
    return { address: row ? this.mapAddress(row) : null };
  }

  async get(customerAccountId: string, addressId: string) {
    const row = await this.findOwned(customerAccountId, addressId);
    return { address: this.mapAddress(row) };
  }

  async create(customerAccountId: string, dto: CreateCustomerAddressDto) {
    const normalized = this.addressNormalization.normalize(
      dto,
      await this.platformCountry(),
    );
    const existingCount = await this.countAddresses(customerAccountId);
    // The first address a customer saves is always their default.
    const shouldBeDefault = dto.isDefault === true || existingCount === 0;
    const now = new Date().toISOString();

    const created = await this.databaseService.transaction(async () => {
      if (shouldBeDefault) {
        await this.clearDefault(customerAccountId);
      }
      return (await this.databaseService
        .prepare(
          `INSERT INTO "CustomerAddress" (
             "customerAccountId", "label", "recipientName", "contactPhone",
             "countryCode", "canton", "city", "postalCode", "street",
             "houseNumber", "addressLine2", "latitude", "longitude",
             "formattedAddress", "deliveryNotes", "isDefault",
             "createdAt", "updatedAt"
           ) VALUES (
             $customerAccountId, $label, $recipientName, $contactPhone,
             $countryCode, $canton, $city, $postalCode, $street,
             $houseNumber, $addressLine2, $latitude, $longitude,
             $formattedAddress, $deliveryNotes, $isDefault,
             $createdAt, $updatedAt
           ) RETURNING *`,
        )
        .get({
          $customerAccountId: customerAccountId,
          $label: dto.label?.trim() || null,
          $recipientName: dto.recipientName?.trim() || null,
          $contactPhone: dto.contactPhone?.trim() || null,
          $countryCode: normalized.countryCode,
          $canton: normalized.canton,
          $city: normalized.city ?? dto.city,
          $postalCode: normalized.postalCode ?? dto.postalCode,
          $street: normalized.street,
          $houseNumber: normalized.houseNumber,
          $addressLine2: dto.addressLine2?.trim() || null,
          $latitude: normalized.latitude,
          $longitude: normalized.longitude,
          $formattedAddress: normalized.formattedAddress,
          $deliveryNotes: dto.deliveryNotes?.trim() || null,
          $isDefault: shouldBeDefault,
          $createdAt: now,
          $updatedAt: now,
        })) as CustomerAddressRow;
    });

    return { address: this.mapAddress(created) };
  }

  async update(
    customerAccountId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ) {
    const existing = await this.findOwned(customerAccountId, addressId);
    const expectedCountry = await this.platformCountry();
    const merged = {
      label: dto.label === undefined ? existing.label : dto.label.trim() || null,
      recipientName:
        dto.recipientName === undefined
          ? existing.recipientName
          : dto.recipientName.trim() || null,
      contactPhone:
        dto.contactPhone === undefined
          ? existing.contactPhone
          : dto.contactPhone.trim() || null,
      countryCode: dto.countryCode
        ? this.addressNormalization.normalizeCountry(dto.countryCode, expectedCountry)
        : existing.countryCode,
      canton: dto.canton === undefined ? existing.canton : dto.canton.trim() || null,
      city: dto.city?.trim() || existing.city,
      postalCode: dto.postalCode?.trim() || existing.postalCode,
      street: dto.street === undefined ? existing.street : dto.street.trim() || null,
      houseNumber:
        dto.houseNumber === undefined
          ? existing.houseNumber
          : dto.houseNumber.trim() || null,
      addressLine2:
        dto.addressLine2 === undefined
          ? existing.addressLine2
          : dto.addressLine2.trim() || null,
      latitude: dto.latitude ?? existing.latitude,
      longitude: dto.longitude ?? existing.longitude,
      deliveryNotes:
        dto.deliveryNotes === undefined
          ? existing.deliveryNotes
          : dto.deliveryNotes.trim() || null,
    };
    // Re-derive the formatted address unless the caller supplied an explicit one.
    const normalized = this.addressNormalization.normalize({
      countryCode: merged.countryCode,
      canton: merged.canton,
      city: merged.city,
      postalCode: merged.postalCode,
      street: merged.street,
      houseNumber: merged.houseNumber,
      latitude: merged.latitude,
      longitude: merged.longitude,
      formattedAddress: dto.formattedAddress ?? null,
    });
    const now = new Date().toISOString();

    await this.databaseService.transaction(async () => {
      if (dto.isDefault === true && !existing.isDefault) {
        await this.clearDefault(customerAccountId);
      }
      await this.databaseService
        .prepare(
          `UPDATE "CustomerAddress" SET
             "label" = $label, "recipientName" = $recipientName,
             "contactPhone" = $contactPhone, "countryCode" = $countryCode,
             "canton" = $canton, "city" = $city, "postalCode" = $postalCode,
             "street" = $street, "houseNumber" = $houseNumber,
             "addressLine2" = $addressLine2, "latitude" = $latitude,
             "longitude" = $longitude, "formattedAddress" = $formattedAddress,
             "deliveryNotes" = $deliveryNotes, "isDefault" = $isDefault,
             "updatedAt" = $updatedAt
           WHERE "id" = $id`,
        )
        .run({
          $id: addressId,
          $label: merged.label,
          $recipientName: merged.recipientName,
          $contactPhone: merged.contactPhone,
          $countryCode: normalized.countryCode,
          $canton: normalized.canton,
          $city: normalized.city ?? merged.city,
          $postalCode: normalized.postalCode ?? merged.postalCode,
          $street: normalized.street,
          $houseNumber: normalized.houseNumber,
          $addressLine2: merged.addressLine2,
          $latitude: normalized.latitude,
          $longitude: normalized.longitude,
          $formattedAddress: normalized.formattedAddress,
          $deliveryNotes: merged.deliveryNotes,
          $isDefault: dto.isDefault === true ? true : existing.isDefault,
          $updatedAt: now,
        });
    });

    return this.get(customerAccountId, addressId);
  }

  async setDefault(customerAccountId: string, addressId: string) {
    await this.findOwned(customerAccountId, addressId);
    await this.databaseService.transaction(async () => {
      await this.clearDefault(customerAccountId);
      await this.databaseService
        .prepare(
          `UPDATE "CustomerAddress"
           SET "isDefault" = TRUE, "updatedAt" = $now
           WHERE "id" = $id`,
        )
        .run({ $id: addressId, $now: new Date().toISOString() });
    });
    return this.get(customerAccountId, addressId);
  }

  async remove(customerAccountId: string, addressId: string) {
    const existing = await this.findOwned(customerAccountId, addressId);
    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(`DELETE FROM "CustomerAddress" WHERE "id" = $id`)
        .run({ $id: addressId });
      // Keep a default alive: promote the most recent remaining address.
      if (existing.isDefault) {
        await this.databaseService
          .prepare(
            `UPDATE "CustomerAddress" SET "isDefault" = TRUE
             WHERE "id" = (
               SELECT "id" FROM "CustomerAddress"
               WHERE "customerAccountId" = $customerAccountId
               ORDER BY "createdAt" DESC
               LIMIT 1
             )`,
          )
          .run({ $customerAccountId: customerAccountId });
      }
    });
    return { deleted: true };
  }

  private async findOwned(
    customerAccountId: string,
    addressId: string,
  ): Promise<CustomerAddressRow> {
    const row = (await this.databaseService
      .prepare(
        `SELECT * FROM "CustomerAddress"
         WHERE "id" = $id AND "customerAccountId" = $customerAccountId
         LIMIT 1`,
      )
      .get({ $id: addressId, $customerAccountId: customerAccountId })) as
      | CustomerAddressRow
      | undefined;
    if (!row) {
      throw new NotFoundException('Address could not be found.');
    }
    return row;
  }

  private async countAddresses(customerAccountId: string): Promise<number> {
    const row = (await this.databaseService
      .prepare(
        `SELECT COUNT(*)::int AS "count" FROM "CustomerAddress"
         WHERE "customerAccountId" = $customerAccountId`,
      )
      .get({ $customerAccountId: customerAccountId })) as { count: number } | undefined;
    return Number(row?.count ?? 0);
  }

  private async clearDefault(customerAccountId: string): Promise<void> {
    await this.databaseService
      .prepare(
        `UPDATE "CustomerAddress" SET "isDefault" = FALSE
         WHERE "customerAccountId" = $customerAccountId AND "isDefault" = TRUE`,
      )
      .run({ $customerAccountId: customerAccountId });
  }

  private mapAddress(row: CustomerAddressRow) {
    return {
      id: row.id,
      label: row.label,
      recipientName: row.recipientName,
      contactPhone: row.contactPhone,
      countryCode: row.countryCode,
      canton: row.canton,
      city: row.city,
      postalCode: row.postalCode,
      street: row.street,
      houseNumber: row.houseNumber,
      addressLine2: row.addressLine2,
      latitude: row.latitude,
      longitude: row.longitude,
      formattedAddress: row.formattedAddress,
      deliveryNotes: row.deliveryNotes,
      isDefault: Boolean(row.isDefault),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
