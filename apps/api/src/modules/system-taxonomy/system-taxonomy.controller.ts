import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { CreateLanguageDto } from './dto/create-language.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { SystemTaxonomyService } from './system-taxonomy.service';

@Controller('system')
@Public()
@ApiTags('system-taxonomy')
export class SystemTaxonomyController {
  constructor(private readonly systemTaxonomyService: SystemTaxonomyService) {}

  @Get('currencies')
  @ApiOperation({ summary: 'List active platform currencies (runtime dropdown source).' })
  @ApiOkResponse({ description: 'Returns the active currency catalog sorted by sortOrder.' })
  async listCurrencies() {
    return {
      currencies: await this.systemTaxonomyService.listActiveCurrencies(),
    };
  }

  @Get('languages')
  @ApiOperation({ summary: 'List active platform languages (runtime dropdown source).' })
  @ApiOkResponse({ description: 'Returns the active language catalog sorted by sortOrder.' })
  async listLanguages() {
    return {
      languages: await this.systemTaxonomyService.listActiveLanguages(),
    };
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'List active payment methods (runtime dropdown source).' })
  @ApiOkResponse({ description: 'Returns the active payment method catalog with iconKey support.' })
  async listPaymentMethods() {
    return {
      paymentMethods: await this.systemTaxonomyService.listActivePaymentMethods(),
    };
  }

  @Get('service-types')
  @ApiOperation({ summary: 'List active service types (delivery, pickup, dine_in, …).' })
  @ApiOkResponse({ description: 'Returns the active service type catalog with iconKey support.' })
  async listServiceTypes() {
    return {
      serviceTypes: await this.systemTaxonomyService.listActiveServiceTypes(),
    };
  }
}

@Controller('admin/system')
@AuthTypes('admin')
@ApiTags('admin-system-taxonomy')
@ApiBearerAuth('bearer')
export class AdminSystemTaxonomyController {
  constructor(private readonly systemTaxonomyService: SystemTaxonomyService) {}

  @Post('currencies')
  @ApiOperation({ summary: 'Create a new currency catalog entry.' })
  @ApiBody({ type: CreateCurrencyDto })
  async createCurrency(@Body() dto: CreateCurrencyDto) {
    return {
      currency: await this.systemTaxonomyService.createCurrency(dto),
    };
  }

  @Post('languages')
  @ApiOperation({ summary: 'Create a new language catalog entry.' })
  @ApiBody({ type: CreateLanguageDto })
  async createLanguage(@Body() dto: CreateLanguageDto) {
    return {
      language: await this.systemTaxonomyService.createLanguage(dto),
    };
  }

  @Post('payment-methods')
  @ApiOperation({ summary: 'Create a new payment method catalog entry.' })
  @ApiBody({ type: CreatePaymentMethodDto })
  async createPaymentMethod(@Body() dto: CreatePaymentMethodDto) {
    return {
      paymentMethod: await this.systemTaxonomyService.createPaymentMethod(dto),
    };
  }

  @Post('service-types')
  @ApiOperation({ summary: 'Create a new service type catalog entry.' })
  @ApiBody({ type: CreateServiceTypeDto })
  async createServiceType(@Body() dto: CreateServiceTypeDto) {
    return {
      serviceType: await this.systemTaxonomyService.createServiceType(dto),
    };
  }
}
