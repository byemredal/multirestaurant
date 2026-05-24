import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { CustomerAddressService } from './customer-address.service';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';

/**
 * Persistent delivery addresses for the authenticated customer. `/default` is
 * the entry point for the authenticated discovery flow.
 */
@Controller('customer/addresses')
@AuthTypes('customer')
@ApiTags('customer-addresses')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
export class CustomerAddressController {
  constructor(private readonly customerAddressService: CustomerAddressService) {}

  @Get()
  @ApiOperation({ summary: 'List the saved delivery addresses of the customer.' })
  @ApiOkResponse({ description: 'Returns saved addresses, default first.' })
  list(@Req() request: AuthenticatedRequest) {
    return this.customerAddressService.list(request.user.id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the customer default delivery address.' })
  @ApiOkResponse({ description: 'Returns the default address or null.' })
  getDefault(@Req() request: AuthenticatedRequest) {
    return this.customerAddressService.getDefault(request.user.id);
  }

  @Get(':addressId')
  @ApiOperation({ summary: 'Get one saved delivery address.' })
  @ApiParam({ name: 'addressId', description: 'Address identifier.' })
  @ApiOkResponse({ description: 'Returns the requested address.' })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('addressId', new ParseUUIDPipe()) addressId: string,
  ) {
    return this.customerAddressService.get(request.user.id, addressId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a saved delivery address.' })
  @ApiBody({ type: CreateCustomerAddressDto })
  @ApiCreatedResponse({ description: 'Returns the created address.' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    return this.customerAddressService.create(request.user.id, dto);
  }

  @Patch(':addressId')
  @ApiOperation({ summary: 'Update a saved delivery address.' })
  @ApiParam({ name: 'addressId', description: 'Address identifier.' })
  @ApiBody({ type: UpdateCustomerAddressDto })
  @ApiOkResponse({ description: 'Returns the updated address.' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('addressId', new ParseUUIDPipe()) addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customerAddressService.update(request.user.id, addressId, dto);
  }

  @Post(':addressId/default')
  @ApiOperation({ summary: 'Promote a saved address to the default address.' })
  @ApiParam({ name: 'addressId', description: 'Address identifier.' })
  @ApiOkResponse({ description: 'Returns the promoted address.' })
  setDefault(
    @Req() request: AuthenticatedRequest,
    @Param('addressId', new ParseUUIDPipe()) addressId: string,
  ) {
    return this.customerAddressService.setDefault(request.user.id, addressId);
  }

  @Delete(':addressId')
  @ApiOperation({ summary: 'Delete a saved delivery address.' })
  @ApiParam({ name: 'addressId', description: 'Address identifier.' })
  @ApiOkResponse({ description: 'Confirms deletion.' })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('addressId', new ParseUUIDPipe()) addressId: string,
  ) {
    return this.customerAddressService.remove(request.user.id, addressId);
  }
}
