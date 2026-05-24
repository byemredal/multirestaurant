import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { ActiveCartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { UpdateCartPreferencesDto } from './dto/update-cart-preferences.dto';
import { CartService } from './cart.service';

@Controller('cart')
@AuthTypes('customer')
@ApiTags('customer-cart')
@ApiBearerAuth('bearer')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('items')
  @ApiOperation({ summary: 'Add a menu item to the authenticated customer cart.' })
  @ApiBody({ type: AddCartItemDto })
  @ApiOkResponse({
    type: ActiveCartResponseDto,
    description: 'Returns the active customer cart with pricing snapshots.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  addItem(@Req() request: AuthenticatedRequest, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(request.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get the authenticated customer cart.' })
  @ApiOkResponse({
    type: ActiveCartResponseDto,
    description: 'Returns the active customer cart or null when no cart exists.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  getCart(@Req() request: AuthenticatedRequest) {
    return this.cartService.getActiveCart(request.user.id);
  }

  @Patch('items/:cartItemId')
  @ApiOperation({ summary: 'Update quantity or option selections for a cart item.' })
  @ApiParam({ name: 'cartItemId', description: 'Cart item identifier.' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiOkResponse({
    type: ActiveCartResponseDto,
    description: 'Returns the updated active customer cart.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('cartItemId', new ParseUUIDPipe({ version: '4' })) cartItemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(request.user.id, cartItemId, dto);
  }

  @Delete('items/:cartItemId')
  @ApiOperation({ summary: 'Remove a cart item from the active customer cart.' })
  @ApiParam({ name: 'cartItemId', description: 'Cart item identifier.' })
  @ApiOkResponse({
    type: ActiveCartResponseDto,
    description: 'Returns the updated cart or null when the cart becomes empty.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('cartItemId', new ParseUUIDPipe({ version: '4' })) cartItemId: string,
  ) {
    return this.cartService.removeItem(request.user.id, cartItemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear the authenticated customer cart.' })
  @ApiOkResponse({
    type: ActiveCartResponseDto,
    description: 'Clears the active cart for the authenticated customer.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  clearCart(@Req() request: AuthenticatedRequest) {
    return this.cartService.clearCart(request.user.id);
  }

  @Patch('preferences')
  @ApiOperation({
    summary: 'Update cart-level preferences (delivery/pickup service type, delivery distance preview).',
  })
  @ApiBody({ type: UpdateCartPreferencesDto })
  @ApiOkResponse({
    type: ActiveCartResponseDto,
    description: 'Returns the updated cart with the new service type and/or delivery distance.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateCartPreferencesDto,
  ) {
    return this.cartService.updatePreferences(request.user.id, dto);
  }
}
