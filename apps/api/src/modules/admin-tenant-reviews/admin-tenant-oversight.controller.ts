import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoles } from '../../common/security/decorators/admin-roles.decorator';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AdminRoleGuard } from '../../common/security/guards/admin-role.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AdminRole } from '../admin-auth/entities/admin-account.entity';
import { UpdateStoreDeliveryFeeSettingDto } from '../store-settings/dto/update-store-delivery-fee-setting.dto';
import { CreateStoreSliderDto } from '../store-settings/dto/create-store-slider.dto';
import { CreateStoreSliderItemDto } from '../store-settings/dto/create-store-slider-item.dto';
import { UpdateStoreLegalDocumentDto } from '../store-settings/dto/update-store-legal-document.dto';
import { UpdateStoreProfileNoteDto } from '../store-settings/dto/update-store-profile-note.dto';
import { UpdateStoreReceiptSettingDto } from '../store-settings/dto/update-store-receipt-setting.dto';
import { UpdateStoreReservationSettingDto } from '../store-settings/dto/update-store-reservation-setting.dto';
import { UpdateStoreSliderDto } from '../store-settings/dto/update-store-slider.dto';
import { UpdateStoreSliderItemDto } from '../store-settings/dto/update-store-slider-item.dto';
import { UpdateStoreTaxSettingDto } from '../store-settings/dto/update-store-tax-setting.dto';
import { AdminTenantReviewsService } from './admin-tenant-reviews.service';

@Controller('admin/tenants')
@AuthTypes('admin')
@UseGuards(AdminRoleGuard)
@ApiBearerAuth('bearer')
@ApiTags('admin-tenant-oversight')
export class AdminTenantOversightController {
  constructor(private readonly reviewsService: AdminTenantReviewsService) {}

  @Get(':id/overview')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  getOverview(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.reviewsService.getTenantBusinessOverview(id);
  }

  @Put(':tenantId/stores/:storeId/tax-settings')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateTaxSettings(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreTaxSettingDto,
  ) {
    return this.reviewsService.updateTenantStoreTaxSettings(
      tenantId,
      storeId,
      request.user.id,
      dto,
    );
  }

  @Put(':tenantId/stores/:storeId/delivery-fee-settings')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateDeliveryFeeSettings(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreDeliveryFeeSettingDto,
  ) {
    return this.reviewsService.updateTenantStoreDeliveryFeeSettings(
      tenantId,
      storeId,
      request.user.id,
      dto,
    );
  }

  @Put(':tenantId/stores/:storeId/reservation-settings')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateReservationSettings(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreReservationSettingDto,
  ) {
    return this.reviewsService.updateTenantStoreReservationSettings(
      tenantId,
      storeId,
      request.user.id,
      dto,
    );
  }

  @Put(':tenantId/stores/:storeId/receipt-settings')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateReceiptSettings(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreReceiptSettingDto,
  ) {
    return this.reviewsService.updateTenantStoreReceiptSettings(
      tenantId,
      storeId,
      request.user.id,
      dto,
    );
  }

  @Put(':tenantId/stores/:storeId/legal-documents/:documentType')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateLegalDocument(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('documentType') documentType: 'terms_and_conditions' | 'privacy_notice' | 'distance_sales',
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreLegalDocumentDto,
  ) {
    return this.reviewsService.updateTenantStoreLegalDocument(
      tenantId,
      storeId,
      documentType,
      request.user.id,
      dto,
    );
  }

  @Put(':tenantId/stores/:storeId/profile-notes/:noteType')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateProfileNote(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('noteType') noteType: 'profile' | 'story' | 'operational',
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreProfileNoteDto,
  ) {
    return this.reviewsService.updateTenantStoreProfileNote(
      tenantId,
      storeId,
      noteType,
      request.user.id,
      dto,
    );
  }

  @Post(':tenantId/stores/:storeId/sliders')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  createSlider(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStoreSliderDto,
  ) {
    return this.reviewsService.createTenantStoreSlider(
      tenantId,
      storeId,
      request.user.id,
      dto,
    );
  }

  @Put(':tenantId/stores/:storeId/sliders/:sliderId')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateSlider(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('sliderId', new ParseUUIDPipe({ version: '4' })) sliderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreSliderDto,
  ) {
    return this.reviewsService.updateTenantStoreSlider(
      tenantId,
      storeId,
      sliderId,
      request.user.id,
      dto,
    );
  }

  @Delete(':tenantId/stores/:storeId/sliders/:sliderId')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  deleteSlider(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('sliderId', new ParseUUIDPipe({ version: '4' })) sliderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviewsService.deleteTenantStoreSlider(
      tenantId,
      storeId,
      sliderId,
      request.user.id,
    );
  }

  @Post(':tenantId/stores/:storeId/sliders/:sliderId/items')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  createSliderItem(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('sliderId', new ParseUUIDPipe({ version: '4' })) sliderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStoreSliderItemDto,
  ) {
    return this.reviewsService.createTenantStoreSliderItem(
      tenantId,
      storeId,
      sliderId,
      request.user.id,
      dto,
    );
  }

  @Put(':tenantId/stores/:storeId/sliders/:sliderId/items/:itemId')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  updateSliderItem(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('sliderId', new ParseUUIDPipe({ version: '4' })) sliderId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreSliderItemDto,
  ) {
    return this.reviewsService.updateTenantStoreSliderItem(
      tenantId,
      storeId,
      sliderId,
      itemId,
      request.user.id,
      dto,
    );
  }

  @Delete(':tenantId/stores/:storeId/sliders/:sliderId/items/:itemId')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  deleteSliderItem(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('sliderId', new ParseUUIDPipe({ version: '4' })) sliderId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviewsService.deleteTenantStoreSliderItem(
      tenantId,
      storeId,
      sliderId,
      itemId,
      request.user.id,
    );
  }
}
