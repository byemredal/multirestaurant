import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export enum CustomerOrderListScope {
  ACTIVE = 'active',
  HISTORY = 'history',
  ALL = 'all',
}

export class ListCustomerOrdersDto {
  @ApiPropertyOptional({
    enum: CustomerOrderListScope,
    example: CustomerOrderListScope.ACTIVE,
    description:
      'Defaults to active. Explicit status filters override the default scope behavior.',
  })
  @IsEnum(CustomerOrderListScope)
  @IsOptional()
  scope?: CustomerOrderListScope;

  @ApiPropertyOptional({
    enum: OrderStatus,
    example: OrderStatus.COMPLETED,
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    example: '2026-04-10T09:00:00.000Z',
    description: 'Optional inclusive lower bound for order creation time.',
  })
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-04-10T18:00:00.000Z',
    description: 'Optional inclusive upper bound for order creation time.',
  })
  @IsDateString()
  @IsOptional()
  createdTo?: string;
}
