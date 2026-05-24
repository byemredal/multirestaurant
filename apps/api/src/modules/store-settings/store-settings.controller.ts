import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { ReplaceDeliveryFeeTiersDto } from './dto/replace-delivery-fee-tiers.dto';
import { UpdateDiscountRuleDto } from './dto/update-discount-rule.dto';
import { UpdateOrderingPolicyDto } from './dto/update-ordering-policy.dto';
import {
  ReplaceStorePaymentMethodsDto,
  ReplaceStoreServiceTypesDto,
} from '../system-taxonomy/dto/replace-store-assignments.dto';
import { UpdateStoreDeliveryFeeSettingDto } from './dto/update-store-delivery-fee-setting.dto';
import { UpdateStoreReceiptSettingDto } from './dto/update-store-receipt-setting.dto';
import { UpdateStoreReservationSettingDto } from './dto/update-store-reservation-setting.dto';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';
import { UpdateStoreTaxSettingDto } from './dto/update-store-tax-setting.dto';
import { UpdateStoreLocalizationDto } from '../system-taxonomy/dto/update-localization.dto';
import { StoreSettingsService } from './store-settings.service';

@Controller('tenant/stores/:storeId')
@AuthTypes('tenant')
@ApiTags('tenant-store-settings')
@ApiBearerAuth('bearer')
export class StoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get store general settings for an owned store.' })
  @ApiOkResponse({ description: 'Returns the general settings record, creating it lazily if missing.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  getSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.getStoreSetting(storeId, request.user.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Upsert store general settings for an owned store.' })
  @ApiBody({ type: UpdateStoreSettingDto })
  upsertSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreSettingDto,
  ) {
    return this.storeSettingsService.upsertStoreSetting(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Put('settings/localization')
  @ApiOperation({
    summary:
      'Update the store default currency / language by referencing system taxonomy ids.',
  })
  @ApiBody({ type: UpdateStoreLocalizationDto })
  upsertLocalization(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreLocalizationDto,
  ) {
    return this.storeSettingsService.upsertStoreLocalization(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Get('tax-settings')
  @ApiOperation({ summary: 'Get store tax settings for an owned store.' })
  getTaxSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.getStoreTaxSetting(storeId, request.user.id);
  }

  @Put('tax-settings')
  @ApiOperation({ summary: 'Upsert store tax settings for an owned store.' })
  @ApiBody({ type: UpdateStoreTaxSettingDto })
  upsertTaxSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreTaxSettingDto,
  ) {
    return this.storeSettingsService.upsertStoreTaxSetting(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Get('discount-rules')
  @ApiOperation({ summary: 'List store discount rules for an owned store.' })
  listDiscountRules(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.listDiscountRules(storeId, request.user.id);
  }

  @Post('discount-rules')
  @ApiOperation({ summary: 'Create a store discount rule for an owned store.' })
  @ApiBody({ type: CreateDiscountRuleDto })
  createDiscountRule(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDiscountRuleDto,
  ) {
    return this.storeSettingsService.createDiscountRule(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Put('discount-rules/:ruleId')
  @ApiOperation({ summary: 'Update a store discount rule for an owned store.' })
  @ApiBody({ type: UpdateDiscountRuleDto })
  updateDiscountRule(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('ruleId', new ParseUUIDPipe({ version: '4' })) ruleId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateDiscountRuleDto,
  ) {
    return this.storeSettingsService.updateDiscountRule(
      storeId,
      ruleId,
      request.user.id,
      dto,
    );
  }

  @Delete('discount-rules/:ruleId')
  @ApiOperation({ summary: 'Delete a store discount rule for an owned store.' })
  deleteDiscountRule(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('ruleId', new ParseUUIDPipe({ version: '4' })) ruleId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.deleteDiscountRule(
      storeId,
      ruleId,
      request.user.id,
    );
  }

  @Get('delivery-fee-settings')
  @ApiOperation({ summary: 'Get store delivery fee settings for an owned store.' })
  getDeliveryFeeSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.getStoreDeliveryFeeSetting(
      storeId,
      request.user.id,
    );
  }

  @Put('delivery-fee-settings')
  @ApiOperation({ summary: 'Upsert store delivery fee settings for an owned store.' })
  @ApiBody({ type: UpdateStoreDeliveryFeeSettingDto })
  upsertDeliveryFeeSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreDeliveryFeeSettingDto,
  ) {
    return this.storeSettingsService.upsertStoreDeliveryFeeSetting(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Get('reservation-settings')
  @ApiOperation({ summary: 'Get store reservation settings for an owned store.' })
  getReservationSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.getStoreReservationSetting(
      storeId,
      request.user.id,
    );
  }

  @Put('reservation-settings')
  @ApiOperation({ summary: 'Upsert store reservation settings for an owned store.' })
  @ApiBody({ type: UpdateStoreReservationSettingDto })
  upsertReservationSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreReservationSettingDto,
  ) {
    return this.storeSettingsService.upsertStoreReservationSetting(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Get('receipt-settings')
  @ApiOperation({ summary: 'Get store receipt settings for an owned store.' })
  getReceiptSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.getStoreReceiptSetting(
      storeId,
      request.user.id,
    );
  }

  @Put('receipt-settings')
  @ApiOperation({ summary: 'Upsert store receipt settings for an owned store.' })
  @ApiBody({ type: UpdateStoreReceiptSettingDto })
  upsertReceiptSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreReceiptSettingDto,
  ) {
    return this.storeSettingsService.upsertStoreReceiptSetting(
      storeId,
      request.user.id,
      dto,
    );
  }

  // ── Commerce: payment methods ──────────────────────────────────────────────
  @Get('payment-methods')
  @ApiOperation({ summary: 'List supported payment methods for an owned store.' })
  listPaymentMethods(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.listPaymentMethods(storeId, request.user.id);
  }

  @Put('payment-methods')
  @ApiOperation({ summary: 'Replace supported payment methods for an owned store.' })
  @ApiBody({ type: ReplaceStorePaymentMethodsDto })
  replacePaymentMethods(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReplaceStorePaymentMethodsDto,
  ) {
    return this.storeSettingsService.replacePaymentMethods(
      storeId,
      request.user.id,
      dto,
    );
  }

  // ── Commerce: service types (FK assignment) ────────────────────────────────
  @Get('service-types')
  @ApiOperation({ summary: 'List supported service types for an owned store.' })
  listServiceTypes(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.listServiceTypes(storeId, request.user.id);
  }

  @Put('service-types')
  @ApiOperation({ summary: 'Replace supported service types for an owned store.' })
  @ApiBody({ type: ReplaceStoreServiceTypesDto })
  replaceServiceTypes(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReplaceStoreServiceTypesDto,
  ) {
    return this.storeSettingsService.replaceServiceTypes(
      storeId,
      request.user.id,
      dto,
    );
  }

  // ── Commerce: ordering policy ──────────────────────────────────────────────
  @Get('ordering-policy')
  @ApiOperation({ summary: 'Get ordering policy (min order, accepted services) for an owned store.' })
  getOrderingPolicy(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.getOrderingPolicy(storeId, request.user.id);
  }

  @Put('ordering-policy')
  @ApiOperation({ summary: 'Upsert ordering policy for an owned store.' })
  @ApiBody({ type: UpdateOrderingPolicyDto })
  upsertOrderingPolicy(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOrderingPolicyDto,
  ) {
    return this.storeSettingsService.upsertOrderingPolicy(
      storeId,
      request.user.id,
      dto,
    );
  }

  // ── Commerce: distance-based delivery fee tiers ────────────────────────────
  @Get('delivery-fee-tiers')
  @ApiOperation({ summary: 'List distance-based delivery fee tiers for an owned store.' })
  listDeliveryFeeTiers(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storeSettingsService.listDeliveryFeeTiers(storeId, request.user.id);
  }

  @Put('delivery-fee-tiers')
  @ApiOperation({ summary: 'Replace distance-based delivery fee tiers for an owned store.' })
  @ApiBody({ type: ReplaceDeliveryFeeTiersDto })
  replaceDeliveryFeeTiers(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReplaceDeliveryFeeTiersDto,
  ) {
    return this.storeSettingsService.replaceDeliveryFeeTiers(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Get('commerce-settings')
  @ApiOperation({ summary: 'Get the consolidated commerce settings bundle for an owned store.' })
  getCommerceSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return (async () => {
      await this.storeSettingsService.getOrderingPolicy(storeId, request.user.id);
      return this.storeSettingsService.getCommerceSettingsBundle(storeId);
    })();
  }
}

@Controller('public/stores/:storeId')
@Public()
@ApiTags('public-stores')
export class PublicStoreCommerceController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get('commerce-settings')
  @ApiOperation({
    summary:
      'Get publicly readable commerce settings (payment methods, min order, delivery fee tiers) for a store.',
  })
  @ApiOkResponse({
    description:
      'Returns active payment methods, ordering policy and distance-based delivery fee tiers used by the customer checkout flow.',
  })
  getCommerceSettings(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    return this.storeSettingsService.getPublicCommerceSettings(storeId);
  }
}
