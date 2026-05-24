import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class UpdateTenantOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED,
    description: 'Tenant updates must follow the backend-enforced order status transition rules.',
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({
    example: 'Kitchen paused for cleaning.',
    description: 'Required for rejected/cancelled transitions. Optional as an operator note otherwise.',
  })
  @ValidateIf((dto: UpdateTenantOrderStatusDto) =>
    [OrderStatus.REJECTED, OrderStatus.CANCELLED].includes(dto.status),
  )
  @IsString()
  @IsNotEmpty()
  @Length(0, 500)
  reason?: string;
}
