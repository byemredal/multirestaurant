import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export enum StaffOrderListScope {
  /** Operational queue: pending confirmation, confirmed, preparing, ready. */
  OPERATIONAL = 'operational',
  /** Closed orders: completed, rejected, cancelled, payment_failed, pending_payment. */
  HISTORY = 'history',
}

/**
 * Query DTO for `GET /staff/orders`. Mirrors the tenant order list shape so a
 * staff member's queue and a tenant's queue behave the same for the operator —
 * the difference is purely scope enforcement (server-side from the staff JWT,
 * never trusted from the client).
 */
export class ListStaffOrdersDto {
  @ApiPropertyOptional({
    enum: StaffOrderListScope,
    example: StaffOrderListScope.OPERATIONAL,
    description:
      'Defaults to operational. Explicit status filters override the scope behavior.',
  })
  @IsEnum(StaffOrderListScope)
  @IsOptional()
  scope?: StaffOrderListScope;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING_CONFIRMATION })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    example: '2472b721-8fcb-436d-b912-ebe6ac984653',
    description:
      'Optional store filter. Must be one of the assigned stores in the staff JWT scope.',
  })
  @IsUUID('4')
  @IsOptional()
  storeId?: string;

  @ApiPropertyOptional({
    example: '2026-05-25T09:00:00.000Z',
    description: 'Optional inclusive lower bound for order creation time.',
  })
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-05-25T18:00:00.000Z',
    description: 'Optional inclusive upper bound for order creation time.',
  })
  @IsDateString()
  @IsOptional()
  createdTo?: string;
}
