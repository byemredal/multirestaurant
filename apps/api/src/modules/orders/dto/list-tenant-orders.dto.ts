import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export enum TenantOrderListScope {
  /** Operational queue: pending confirmation, confirmed, preparing, ready. */
  OPERATIONAL = 'operational',
  /** Closed orders: completed, rejected, cancelled, payment_failed, pending_payment. */
  HISTORY = 'history',
}

export class ListTenantOrdersDto {
  @ApiPropertyOptional({
    enum: TenantOrderListScope,
    example: TenantOrderListScope.OPERATIONAL,
    description:
      'Defaults to operational. Explicit status filters override the scope behavior.',
  })
  @IsEnum(TenantOrderListScope)
  @IsOptional()
  scope?: TenantOrderListScope;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING_CONFIRMATION })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  @IsUUID('4')
  @IsOptional()
  storeId?: string;

  @ApiPropertyOptional({
    example: '2026-04-09T09:00:00.000Z',
    description: 'Optional inclusive lower bound for order creation time.',
  })
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-04-09T18:00:00.000Z',
    description: 'Optional inclusive upper bound for order creation time.',
  })
  @IsDateString()
  @IsOptional()
  createdTo?: string;
}
