import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { StoresService } from '../stores/stores.service';
import { StoreSettingsStore } from '../store-settings/store-settings.store';
import { SystemTaxonomyService } from '../system-taxonomy/system-taxonomy.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { UpdateCartPreferencesDto } from './dto/update-cart-preferences.dto';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartItemOptionSelection } from './entities/cart-item-option-selection.entity';

@Injectable()
export class CartService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storesService: StoresService,
    private readonly storeSettingsStore: StoreSettingsStore,
    private readonly systemTaxonomyService: SystemTaxonomyService,
  ) {}

  async updatePreferences(
    customerAccountId: string,
    dto: UpdateCartPreferencesDto,
  ) {
    if (
      dto.serviceTypeId === undefined &&
      dto.serviceType === undefined &&
      dto.paymentMethodId === undefined &&
      dto.deliveryDistanceKm === undefined
    ) {
      throw new BadRequestException(
        'Provide serviceTypeId, serviceType, paymentMethodId or deliveryDistanceKm to update preferences.',
      );
    }

    const cart = await this.findCartByCustomer(customerAccountId);
    if (!cart) {
      throw new NotFoundException('Active cart could not be found.');
    }

    let nextServiceTypeId: string | null = cart.serviceTypeId;
    let nextServiceTypeSnapshot = cart.serviceTypeSnapshot;
    // serviceTypeId (UUID) keeps the original contract and takes precedence;
    // serviceType (code) is the backward-compatible path the web cart uses.
    if (dto.serviceTypeId !== undefined) {
      const assignment = await this.storeSettingsStore.findActiveServiceTypeAssignment(
        cart.storeId,
        dto.serviceTypeId,
      );
      if (!assignment) {
        throw new BadRequestException({
          code: 'service_type_unavailable',
          message: 'Bu restoran seçilen servis türünü desteklemiyor.',
        });
      }
      nextServiceTypeId = assignment.serviceTypeId;
      nextServiceTypeSnapshot = assignment.code;
    } else if (dto.serviceType !== undefined) {
      const activeServiceTypes = await this.storeSettingsStore.listActiveServiceTypes(
        cart.storeId,
      );
      if (activeServiceTypes.length === 0) {
        throw new BadRequestException({
          code: 'no_active_service_types',
          message: 'Restoranın aktif servis türü bulunmuyor.',
        });
      }
      const match = activeServiceTypes.find((type) => type.code === dto.serviceType);
      if (!match) {
        throw new BadRequestException({
          code: 'service_type_unavailable',
          message: 'Bu restoran seçilen servis türünü desteklemiyor.',
        });
      }
      nextServiceTypeId = match.serviceTypeId;
      nextServiceTypeSnapshot = match.code;
    }

    let nextPaymentMethodId: string | null = cart.paymentMethodId;
    let nextPaymentMethodSnapshot: string | null = cart.paymentMethodSnapshot;
    if (dto.paymentMethodId !== undefined) {
      const assignment = await this.storeSettingsStore.findActivePaymentMethodAssignment(
        cart.storeId,
        dto.paymentMethodId,
      );
      if (!assignment) {
        throw new BadRequestException(
          'This store does not offer the selected payment method.',
        );
      }
      nextPaymentMethodId = assignment.paymentMethodId;
      nextPaymentMethodSnapshot = assignment.code;
    }

    const nextDistance =
      dto.deliveryDistanceKm === undefined ? cart.deliveryDistanceKm : dto.deliveryDistanceKm;

    await this.databaseService
      .prepare(
        `UPDATE "Cart"
         SET "serviceTypeId" = $serviceTypeId,
             "serviceTypeSnapshot" = $serviceTypeSnapshot,
             "paymentMethodId" = $paymentMethodId,
             "paymentMethodSnapshot" = $paymentMethodSnapshot,
             "deliveryDistanceKm" = $deliveryDistanceKm,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: cart.id,
        $serviceTypeId: nextServiceTypeId,
        $serviceTypeSnapshot: nextServiceTypeSnapshot,
        $paymentMethodId: nextPaymentMethodId,
        $paymentMethodSnapshot: nextPaymentMethodSnapshot,
        $deliveryDistanceKm: nextDistance,
        $updatedAt: new Date().toISOString(),
      });

    return {
      cart: await this.buildCartPayload(cart.id),
    };
  }

  async getActiveCart(customerAccountId: string) {
    const cart = await this.findCartByCustomer(customerAccountId);
    return {
      cart: cart ? await this.buildCartPayload(cart.id) : null,
    };
  }

  async addItem(customerAccountId: string, dto: AddCartItemDto) {
    const quantity = dto.quantity;
    const selectedOptions = dto.selectedOptions ?? [];
    await this.storesService.assertStoreOrderable(dto.storeId);
    const menuItem = await this.findMenuItemOrThrow(dto.storeId, dto.menuItemId);
    const validatedSelections = await this.validateSelections(menuItem, selectedOptions);

    const cart = await this.databaseService.transaction(async () => {
      let activeCart = await this.findCartByCustomer(customerAccountId);

      if (!activeCart) {
        activeCart = await this.createCart(
          customerAccountId,
          dto.storeId,
          menuItem.currencyId,
          menuItem.currencyCode,
          dto.serviceType,
        );
      } else if (activeCart.storeId !== dto.storeId) {
        throw new ConflictException(
          'Your active cart already belongs to another store. Clear it before adding items from a different store.',
        );
      }

      const signature = this.buildSelectionSignature(validatedSelections);
      const existing = await this.findMatchingCartItem(
        activeCart.id,
        dto.menuItemId,
        signature,
      );

      if (existing) {
        const nextQuantity = existing.quantity + quantity;
        await this.persistCartItem(
          existing.id,
          activeCart.id,
          menuItem,
          nextQuantity,
          signature,
        );
        await this.replaceSelections(existing.id, validatedSelections);
      } else {
        const cartItemId = randomUUID();
        await this.persistCartItem(
          cartItemId,
          activeCart.id,
          menuItem,
          quantity,
          signature,
        );
        await this.replaceSelections(cartItemId, validatedSelections);
      }

      await this.recalculateCartTotals(activeCart.id);
      return activeCart;
    });

    return {
      cart: await this.buildCartPayload(cart.id),
    };
  }

  async updateItem(
    customerAccountId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
  ) {
    if (dto.quantity === undefined && dto.selectedOptions === undefined) {
      throw new BadRequestException('Either quantity or selectedOptions must be provided.');
    }

    const existingCartItem = await this.findCartItemForCustomerOrThrow(
      customerAccountId,
      cartItemId,
    );
    const cart = await this.findCartById(existingCartItem.cartId);
    if (!cart) {
      throw new NotFoundException('Active cart could not be found.');
    }

    await this.storesService.assertStoreOrderable(cart.storeId);
    const menuItem = await this.findMenuItemByIdOrThrow(
      existingCartItem.menuItemId,
      cart.storeId,
    );
    const selections =
      dto.selectedOptions !== undefined
        ? await this.validateSelections(menuItem, dto.selectedOptions)
        : await this.loadSelectionsForCartItem(existingCartItem.id);
    const quantity = dto.quantity ?? existingCartItem.quantity;
    const signature = this.buildSelectionSignature(selections);

    await this.databaseService.transaction(async () => {
      const mergeTarget = await this.findMatchingCartItem(
        cart.id,
        existingCartItem.menuItemId,
        signature,
        existingCartItem.id,
      );

      if (mergeTarget) {
        const mergedQuantity = mergeTarget.quantity + quantity;
        await this.persistCartItem(
          mergeTarget.id,
          cart.id,
          menuItem,
          mergedQuantity,
          signature,
        );
        await this.replaceSelections(mergeTarget.id, selections);
        await this.deleteCartItemTree(existingCartItem.id);
      } else {
        await this.persistCartItem(
          existingCartItem.id,
          cart.id,
          menuItem,
          quantity,
          signature,
        );
        if (dto.selectedOptions !== undefined) {
          await this.replaceSelections(existingCartItem.id, selections);
        }
      }

      await this.recalculateCartTotals(cart.id);
    });

    return {
      cart: await this.buildCartPayload(cart.id),
    };
  }

  async removeItem(customerAccountId: string, cartItemId: string) {
    const existingCartItem = await this.findCartItemForCustomerOrThrow(
      customerAccountId,
      cartItemId,
    );

    await this.databaseService.transaction(async () => {
      await this.deleteCartItemTree(existingCartItem.id);
      const remainingItems = await this.countCartItems(existingCartItem.cartId);
      if (remainingItems === 0) {
        await this.deleteCart(existingCartItem.cartId);
        return;
      }

      await this.recalculateCartTotals(existingCartItem.cartId);
    });

    return this.getActiveCart(customerAccountId);
  }

  async clearCart(customerAccountId: string) {
    const cart = await this.findCartByCustomer(customerAccountId);
    if (!cart) {
      return { cart: null };
    }

    await this.databaseService.transaction(async () => {
      await this.deleteCart(cart.id);
    });

    return { cart: null };
  }

  private async createCart(
    customerAccountId: string,
    storeId: string,
    currencyId: string,
    currencySnapshot: string,
    preferredServiceType?: 'delivery' | 'pickup',
  ) {
    const now = new Date();
    let serviceTypes = await this.storeSettingsStore.listActiveServiceTypes(storeId);

    // Self-heal: a store with no service-type assignments (legacy / created
    // before defaults were seeded) is backfilled from its ordering policy so
    // add-to-cart works instead of throwing. Only genuinely corrupt data (no
    // catalog match at all) still fails.
    if (serviceTypes.length === 0) {
      const policy = await this.storeSettingsStore.getOrCreateOrderingPolicy(storeId);
      await this.storeSettingsStore.ensureDefaultStoreServiceTypes(storeId, {
        acceptsDelivery: policy.acceptsDelivery,
        acceptsPickup: policy.acceptsPickup,
      });
      serviceTypes = await this.storeSettingsStore.listActiveServiceTypes(storeId);
    }

    if (serviceTypes.length === 0) {
      throw new ConflictException('Store has no active service types configured.');
    }

    // Honour the route/mode the customer is browsing in (delivery vs pickup)
    // when it is actually offered; otherwise fall back to the first active type.
    const defaultServiceType =
      (preferredServiceType &&
        serviceTypes.find((type) => type.code === preferredServiceType)) ||
      serviceTypes[0];

    const cart: Cart = {
      id: randomUUID(),
      customerAccountId,
      storeId,
      subtotalAmount: 0,
      totalAmount: 0,
      currencyId,
      currencySnapshot,
      serviceTypeId: defaultServiceType.serviceTypeId,
      serviceTypeSnapshot: defaultServiceType.code,
      paymentMethodId: null,
      paymentMethodSnapshot: null,
      deliveryDistanceKm: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "Cart" (
          "id", "customerAccountId", "storeId", "subtotalAmount",
          "totalAmount", "currencyId", "currencySnapshot",
          "serviceTypeId", "serviceTypeSnapshot",
          "paymentMethodId", "paymentMethodSnapshot",
          "deliveryDistanceKm", "createdAt", "updatedAt"
        ) VALUES (
          $id, $customerAccountId, $storeId, $subtotalAmount,
          $totalAmount, $currencyId, $currencySnapshot,
          $serviceTypeId, $serviceTypeSnapshot,
          $paymentMethodId, $paymentMethodSnapshot,
          $deliveryDistanceKm, $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: cart.id,
        $customerAccountId: cart.customerAccountId,
        $storeId: cart.storeId,
        $subtotalAmount: cart.subtotalAmount,
        $totalAmount: cart.totalAmount,
        $currencyId: cart.currencyId,
        $currencySnapshot: cart.currencySnapshot,
        $serviceTypeId: cart.serviceTypeId,
        $serviceTypeSnapshot: cart.serviceTypeSnapshot,
        $paymentMethodId: cart.paymentMethodId,
        $paymentMethodSnapshot: cart.paymentMethodSnapshot,
        $deliveryDistanceKm: cart.deliveryDistanceKm,
        $createdAt: cart.createdAt.toISOString(),
        $updatedAt: cart.updatedAt.toISOString(),
      });

    return cart;
  }

  private async findCartByCustomer(customerAccountId: string) {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Cart" WHERE "customerAccountId" = $customerAccountId LIMIT 1`)
      .get({ $customerAccountId: customerAccountId })) as CartRow | undefined;

    return row ? this.mapCart(row) : null;
  }

  private async findCartById(cartId: string) {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Cart" WHERE "id" = $id LIMIT 1`)
      .get({ $id: cartId })) as CartRow | undefined;

    return row ? this.mapCart(row) : null;
  }

  private async buildCartPayload(cartId: string) {
    const cart = await this.findCartById(cartId);
    if (!cart) {
      return null;
    }

    const store = (await this.databaseService
      .prepare(`SELECT "name" FROM "Store" WHERE "id" = $id LIMIT 1`)
      .get({ $id: cart.storeId })) as { name: string } | undefined;

    const items = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "CartItem"
         WHERE "cartId" = $cartId
         ORDER BY "createdAt" ASC`,
      )
      .all({ $cartId: cartId })) as unknown as CartItemRow[];

    return {
      ...cart,
      store: {
        id: cart.storeId,
        name: store?.name ?? null,
      },
      storeName: store?.name ?? null,
      serviceTypeId: cart.serviceTypeId,
      serviceTypeSnapshot: cart.serviceTypeSnapshot,
      paymentMethodId: cart.paymentMethodId,
      paymentMethodSnapshot: cart.paymentMethodSnapshot,
      deliveryDistanceKm: cart.deliveryDistanceKm,
      itemCount: items.length,
      hasItems: items.length > 0,
      canUpdateCart: items.length > 0,
      canCheckout: items.length > 0,
      items: await Promise.all(
        items.map(async (item) => ({
          ...this.mapCartItem(item),
          selectedOptions: await this.loadSelectionsForCartItem(item.id),
        })),
      ),
    };
  }

  private async validateSelections(
    menuItem: MenuItemRow,
    selectedOptions: SelectedOptionInput[],
  ) {
    const groups = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionGroup"
         WHERE "menuItemId" = $menuItemId`,
      )
      .all({ $menuItemId: menuItem.id })) as unknown as MenuOptionGroupRow[];

    const activeGroups = groups.filter((group) => Boolean(group.isActive));
    const groupMap = new Map(activeGroups.map((group) => [group.id, group]));

    const signatureSet = new Set<string>();
    const groupedSelections = new Map<string, SelectedOptionInput[]>();

    for (const selection of selectedOptions) {
      const uniqueKey = `${selection.optionGroupId}:${selection.optionItemId}`;
      if (signatureSet.has(uniqueKey)) {
        throw new BadRequestException('Duplicate option selections are not allowed.');
      }

      signatureSet.add(uniqueKey);

      const group = groupMap.get(selection.optionGroupId);
      if (!group) {
        throw new BadRequestException('Selected option group is not valid for this menu item.');
      }

      const list = groupedSelections.get(selection.optionGroupId) ?? [];
      list.push(selection);
      groupedSelections.set(selection.optionGroupId, list);
    }

    const validatedSelections: ValidatedOptionSelection[] = [];

    for (const group of activeGroups) {
      const selectionsForGroup = groupedSelections.get(group.id) ?? [];
      if (group.minSelections > 0 && selectionsForGroup.length < group.minSelections) {
        throw new BadRequestException(
          `Option group "${group.name}" requires at least ${group.minSelections} selection(s).`,
        );
      }

      if (selectionsForGroup.length > group.maxSelections) {
        throw new BadRequestException(
          `Option group "${group.name}" allows at most ${group.maxSelections} selection(s).`,
        );
      }

      if (Boolean(group.isRequired) && selectionsForGroup.length === 0) {
        throw new BadRequestException(`Option group "${group.name}" is required.`);
      }

      for (const selection of selectionsForGroup) {
        const optionItem = (await this.databaseService
          .prepare(
            `SELECT *
             FROM "MenuOptionItem"
             WHERE "id" = $id AND "optionGroupId" = $optionGroupId`,
          )
          .get({
            $id: selection.optionItemId,
            $optionGroupId: group.id,
          })) as MenuOptionItemRow | undefined;

        if (!optionItem) {
          throw new BadRequestException('Selected option item is not valid for this option group.');
        }

        if (!Boolean(optionItem.isActive)) {
          throw new BadRequestException('Inactive option items cannot be added to the cart.');
        }

        validatedSelections.push({
          optionGroupId: group.id,
          optionItemId: optionItem.id,
          optionGroupNameSnapshot: group.name,
          optionItemNameSnapshot: optionItem.name,
          optionPriceDeltaSnapshot: optionItem.priceDelta,
        });
      }
    }

    return validatedSelections.sort((left, right) =>
      `${left.optionGroupId}:${left.optionItemId}`.localeCompare(
        `${right.optionGroupId}:${right.optionItemId}`,
      ),
    );
  }

  private async findMenuItemOrThrow(storeId: string, menuItemId: string) {
    const item = (await this.databaseService
      .prepare(
        `SELECT mi.*, mc."isActive" AS "categoryIsActive",
                c."code" AS "currencyCode"
         FROM "MenuItem" mi
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         LEFT JOIN "MenuCategory" mc
           ON mc."id" = mi."categoryId"
         WHERE mi."id" = $id
           AND mi."storeId" = $storeId`,
      )
      .get({
        $id: menuItemId,
        $storeId: storeId,
      })) as MenuItemRow | undefined;

    if (!item) {
      throw new NotFoundException('Menu item could not be found for this store.');
    }

    if (!Boolean(item.isActive)) {
      throw new BadRequestException('Inactive menu items cannot be added to the cart.');
    }

    if (
      item.availabilityType !== 'always' &&
      item.availabilityType !== 'inherit_store_status'
    ) {
      throw new ConflictException('Menu item is not orderable right now.');
    }

    if (item.categoryId && item.categoryIsActive === false) {
      throw new ConflictException('Menu item category is not available right now.');
    }

    return item;
  }

  private async findMenuItemByIdOrThrow(menuItemId: string, storeId: string) {
    const item = (await this.databaseService
      .prepare(
        `SELECT mi.*, mc."isActive" AS "categoryIsActive",
                c."code" AS "currencyCode"
         FROM "MenuItem" mi
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         LEFT JOIN "MenuCategory" mc
           ON mc."id" = mi."categoryId"
         WHERE mi."id" = $id
           AND mi."storeId" = $storeId`,
      )
      .get({
        $id: menuItemId,
        $storeId: storeId,
      })) as MenuItemRow | undefined;

    if (!item) {
      throw new NotFoundException('Menu item could not be found.');
    }

    if (!Boolean(item.isActive)) {
      throw new BadRequestException('Inactive menu items cannot be added to the cart.');
    }

    if (
      item.availabilityType !== 'always' &&
      item.availabilityType !== 'inherit_store_status'
    ) {
      throw new ConflictException('Menu item is not orderable right now.');
    }

    if (item.categoryId && item.categoryIsActive === false) {
      throw new ConflictException('Menu item category is not available right now.');
    }

    return item;
  }

  private async persistCartItem(
    cartItemId: string,
    cartId: string,
    menuItem: MenuItemRow,
    quantity: number,
    selectionSignature: string,
  ) {
    const currentSelections =
      cartItemId && (await this.countSelectionRows(cartItemId)) > 0
        ? await this.loadSelectionsForCartItem(cartItemId)
        : [];
    const lineBaseTotal = this.roundPrice(menuItem.basePrice * quantity);
    const lineOptionsTotal = this.roundPrice(
      currentSelections.reduce((sum, selection) => sum + selection.optionPriceDeltaSnapshot, 0) *
        quantity,
    );
    const lineTotal = this.roundPrice(lineBaseTotal + lineOptionsTotal);
    const timestamp = new Date().toISOString();

    await this.databaseService
      .prepare(
        `INSERT INTO "CartItem" (
          "id", "cartId", "menuItemId", "itemNameSnapshot", "unitBasePriceSnapshot",
          "currencySnapshot", "quantity", "lineBaseTotal", "lineOptionsTotal",
          "lineTotal", "selectionSignature", "createdAt", "updatedAt"
        ) VALUES (
          $id, $cartId, $menuItemId, $itemNameSnapshot, $unitBasePriceSnapshot,
          $currencySnapshot, $quantity, $lineBaseTotal, $lineOptionsTotal,
          $lineTotal, $selectionSignature, $createdAt, $updatedAt
        )
        ON CONFLICT("id") DO UPDATE SET
          "itemNameSnapshot" = excluded."itemNameSnapshot",
          "unitBasePriceSnapshot" = excluded."unitBasePriceSnapshot",
          "currencySnapshot" = excluded."currencySnapshot",
          "quantity" = excluded."quantity",
          "lineBaseTotal" = excluded."lineBaseTotal",
          "lineOptionsTotal" = excluded."lineOptionsTotal",
          "lineTotal" = excluded."lineTotal",
          "selectionSignature" = excluded."selectionSignature",
          "updatedAt" = excluded."updatedAt"`,
      )
      .run({
        $id: cartItemId,
        $cartId: cartId,
        $menuItemId: menuItem.id,
        $itemNameSnapshot: menuItem.name,
        $unitBasePriceSnapshot: menuItem.basePrice,
        $currencySnapshot: menuItem.currencyCode,
        $quantity: quantity,
        $lineBaseTotal: lineBaseTotal,
        $lineOptionsTotal: lineOptionsTotal,
        $lineTotal: lineTotal,
        $selectionSignature: selectionSignature,
        $createdAt: timestamp,
        $updatedAt: timestamp,
      });
  }

  private async replaceSelections(
    cartItemId: string,
    selections: ValidatedOptionSelection[],
  ) {
    await this.databaseService
      .prepare(`DELETE FROM "CartItemOptionSelection" WHERE "cartItemId" = $cartItemId`)
      .run({ $cartItemId: cartItemId });

    const timestamp = new Date().toISOString();
    const insertStatement = this.databaseService.prepare(
      `INSERT INTO "CartItemOptionSelection" (
        "id", "cartItemId", "optionGroupId", "optionItemId",
        "optionGroupNameSnapshot", "optionItemNameSnapshot",
        "optionPriceDeltaSnapshot", "createdAt", "updatedAt"
      ) VALUES (
        $id, $cartItemId, $optionGroupId, $optionItemId,
        $optionGroupNameSnapshot, $optionItemNameSnapshot,
        $optionPriceDeltaSnapshot, $createdAt, $updatedAt
      )`,
    );

    for (const selection of selections) {
      await insertStatement.run({
        $id: randomUUID(),
        $cartItemId: cartItemId,
        $optionGroupId: selection.optionGroupId,
        $optionItemId: selection.optionItemId,
        $optionGroupNameSnapshot: selection.optionGroupNameSnapshot,
        $optionItemNameSnapshot: selection.optionItemNameSnapshot,
        $optionPriceDeltaSnapshot: selection.optionPriceDeltaSnapshot,
        $createdAt: timestamp,
        $updatedAt: timestamp,
      });
    }

    const cartItem = (await this.databaseService
      .prepare(`SELECT * FROM "CartItem" WHERE "id" = $id`)
      .get({ $id: cartItemId })) as CartItemRow | undefined;

    if (!cartItem) {
      throw new NotFoundException('Cart item could not be found.');
    }

    const cartItemQuantity = Number(cartItem.quantity);
    const cartItemLineBaseTotal = Number(cartItem.lineBaseTotal);
    const lineOptionsTotal = this.roundPrice(
      selections.reduce((sum, selection) => sum + selection.optionPriceDeltaSnapshot, 0) *
        cartItemQuantity,
    );
    const lineTotal = this.roundPrice(cartItemLineBaseTotal + lineOptionsTotal);

    await this.databaseService
      .prepare(
        `UPDATE "CartItem"
         SET "lineOptionsTotal" = $lineOptionsTotal, "lineTotal" = $lineTotal, "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: cartItemId,
        $lineOptionsTotal: lineOptionsTotal,
        $lineTotal: lineTotal,
        $updatedAt: new Date().toISOString(),
      });
  }

  private async findMatchingCartItem(
    cartId: string,
    menuItemId: string,
    selectionSignature: string,
    excludeCartItemId?: string,
  ) {
    const statement = excludeCartItemId
      ? this.databaseService.prepare(
          `SELECT *
           FROM "CartItem"
           WHERE "cartId" = $cartId
             AND "menuItemId" = $menuItemId
             AND "selectionSignature" = $selectionSignature
             AND "id" != $excludeCartItemId
           LIMIT 1`,
        )
      : this.databaseService.prepare(
          `SELECT *
           FROM "CartItem"
           WHERE "cartId" = $cartId
             AND "menuItemId" = $menuItemId
             AND "selectionSignature" = $selectionSignature
           LIMIT 1`,
        );

    const row = (await statement.get({
      $cartId: cartId,
      $menuItemId: menuItemId,
      $selectionSignature: selectionSignature,
      $excludeCartItemId: excludeCartItemId,
    })) as CartItemRow | undefined;

    return row ? this.mapCartItem(row) : null;
  }

  private async findCartItemForCustomerOrThrow(
    customerAccountId: string,
    cartItemId: string,
  ) {
    const existingCartItem = (await this.databaseService
      .prepare(`SELECT * FROM "CartItem" WHERE "id" = $id LIMIT 1`)
      .get({ $id: cartItemId })) as CartItemRow | undefined;

    if (existingCartItem) {
      const owningCart = (await this.databaseService
        .prepare(`SELECT "customerAccountId" FROM "Cart" WHERE "id" = $id LIMIT 1`)
        .get({ $id: existingCartItem.cartId })) as { customerAccountId: string } | undefined;

      if (owningCart && owningCart.customerAccountId !== customerAccountId) {
        throw new ForbiddenException('You can only manage your own cart items.');
      }
    }

    const row = (await this.databaseService
      .prepare(
        `SELECT ci.*
         FROM "CartItem" ci
         INNER JOIN "Cart" c ON c."id" = ci."cartId"
         WHERE ci."id" = $cartItemId AND c."customerAccountId" = $customerAccountId
         LIMIT 1`,
      )
      .get({
        $cartItemId: cartItemId,
        $customerAccountId: customerAccountId,
      })) as CartItemRow | undefined;

    if (!row) {
      throw new NotFoundException('Cart item could not be found for this customer.');
    }

    return this.mapCartItem(row);
  }

  private async deleteCartItemTree(cartItemId: string) {
    await this.databaseService
      .prepare(`DELETE FROM "CartItemOptionSelection" WHERE "cartItemId" = $cartItemId`)
      .run({ $cartItemId: cartItemId });
    await this.databaseService
      .prepare(`DELETE FROM "CartItem" WHERE "id" = $id`)
      .run({ $id: cartItemId });
  }

  private async deleteCart(cartId: string) {
    await this.databaseService
      .prepare(`DELETE FROM "Cart" WHERE "id" = $id`)
      .run({ $id: cartId });
  }

  private async countCartItems(cartId: string) {
    const row = (await this.databaseService
      .prepare(`SELECT COUNT(*) AS "count" FROM "CartItem" WHERE "cartId" = $cartId`)
      .get({ $cartId: cartId })) as { count: number | string };

    return Number(row.count ?? 0);
  }

  private async countSelectionRows(cartItemId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT COUNT(*) AS "count" FROM "CartItemOptionSelection" WHERE "cartItemId" = $cartItemId`,
      )
      .get({ $cartItemId: cartItemId })) as { count: number | string };

    return Number(row.count ?? 0);
  }

  private async loadSelectionsForCartItem(cartItemId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "CartItemOptionSelection"
         WHERE "cartItemId" = $cartItemId
         ORDER BY "optionGroupNameSnapshot" ASC, "optionItemNameSnapshot" ASC`,
      )
      .all({ $cartItemId: cartItemId })) as unknown as CartItemOptionSelectionRow[];

    return rows.map((row) => this.mapCartItemOptionSelection(row));
  }

  private async recalculateCartTotals(cartId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT
           COALESCE(SUM("lineTotal"), 0) AS "subtotalAmount",
           MAX("currencySnapshot") AS "currencySnapshot"
         FROM "CartItem"
         WHERE "cartId" = $cartId`,
      )
      .get({ $cartId: cartId })) as {
      subtotalAmount: number | string;
      currencySnapshot: string | null;
    };

    const subtotalAmount = this.roundPrice(Number(row.subtotalAmount ?? 0));
    await this.databaseService
      .prepare(
        `UPDATE "Cart"
         SET "subtotalAmount" = $subtotalAmount,
             "totalAmount" = $totalAmount,
             "currencySnapshot" = COALESCE($currencySnapshot, "currencySnapshot"),
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: cartId,
        $subtotalAmount: subtotalAmount,
        $totalAmount: subtotalAmount,
        $currencySnapshot: row.currencySnapshot,
        $updatedAt: new Date().toISOString(),
      });
  }

  private buildSelectionSignature(selections: ValidatedOptionSelection[]) {
    return selections
      .map((selection) => `${selection.optionGroupId}:${selection.optionItemId}`)
      .join('|');
  }

  private roundPrice(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private mapCart(row: CartRow): Cart {
    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      storeId: row.storeId,
      subtotalAmount: Number(row.subtotalAmount),
      totalAmount: Number(row.totalAmount),
      currencyId: row.currencyId ?? null,
      currencySnapshot: row.currencySnapshot,
      serviceTypeId: row.serviceTypeId ?? null,
      serviceTypeSnapshot: row.serviceTypeSnapshot,
      paymentMethodId: row.paymentMethodId ?? null,
      paymentMethodSnapshot: row.paymentMethodSnapshot ?? null,
      deliveryDistanceKm:
        row.deliveryDistanceKm === null || row.deliveryDistanceKm === undefined
          ? null
          : Number(row.deliveryDistanceKm),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapCartItem(row: CartItemRow): CartItem {
    return {
      id: row.id,
      cartId: row.cartId,
      menuItemId: row.menuItemId,
      itemNameSnapshot: row.itemNameSnapshot,
      unitBasePriceSnapshot: Number(row.unitBasePriceSnapshot),
      currencySnapshot: row.currencySnapshot,
      quantity: Number(row.quantity),
      lineBaseTotal: Number(row.lineBaseTotal),
      lineOptionsTotal: Number(row.lineOptionsTotal),
      lineTotal: Number(row.lineTotal),
      selectionSignature: row.selectionSignature,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapCartItemOptionSelection(
    row: CartItemOptionSelectionRow,
  ): CartItemOptionSelection {
    return {
      id: row.id,
      cartItemId: row.cartItemId,
      optionGroupId: row.optionGroupId,
      optionItemId: row.optionItemId,
      optionGroupNameSnapshot: row.optionGroupNameSnapshot,
      optionItemNameSnapshot: row.optionItemNameSnapshot,
      optionPriceDeltaSnapshot: Number(row.optionPriceDeltaSnapshot),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

interface SelectedOptionInput {
  optionGroupId: string;
  optionItemId: string;
}

interface ValidatedOptionSelection extends SelectedOptionInput {
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number;
}

interface CartRow {
  id: string;
  customerAccountId: string;
  storeId: string;
  subtotalAmount: number | string;
  totalAmount: number | string;
  currencyId: string | null;
  currencySnapshot: string;
  serviceTypeId: string | null;
  serviceTypeSnapshot: string;
  paymentMethodId: string | null;
  paymentMethodSnapshot: string | null;
  deliveryDistanceKm?: number | string | null;
  createdAt: string;
  updatedAt: string;
}

interface CartItemRow {
  id: string;
  cartId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitBasePriceSnapshot: number | string;
  currencySnapshot: string;
  quantity: number | string;
  lineBaseTotal: number | string;
  lineOptionsTotal: number | string;
  lineTotal: number | string;
  selectionSignature: string;
  createdAt: string;
  updatedAt: string;
}

interface CartItemOptionSelectionRow {
  id: string;
  cartItemId: string;
  optionGroupId: string;
  optionItemId: string;
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number | string;
  createdAt: string;
  updatedAt: string;
}

interface MenuItemRow {
  id: string;
  storeId: string;
  categoryId: string | null;
  categoryIsActive?: boolean | null;
  name: string;
  description: string | null;
  basePrice: number;
  currencyId: string;
  currencyCode: string;
  isActive: boolean;
  availabilityType: string;
  createdAt: string;
  updatedAt: string;
}

interface MenuOptionGroupRow {
  id: string;
  menuItemId: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MenuOptionItemRow {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
