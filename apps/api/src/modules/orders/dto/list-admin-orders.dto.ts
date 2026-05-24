import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

/**
 * Query filters for the read-only platform-wide admin order list.
 * No scope concept — admins see every order across every store.
 */
export class ListAdminOrdersDto {
  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING_CONFIRMATION })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    example: '2472b721-8fcb-436d-b912-ebe6ac984653',
    description: 'Optional store filter.',
  })
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
