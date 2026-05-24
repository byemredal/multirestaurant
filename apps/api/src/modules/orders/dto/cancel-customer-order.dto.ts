import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CancelCustomerOrderDto {
  @ApiPropertyOptional({
    example: 'Customer cancelled before payment completion.',
    description: 'Optional customer-visible note recorded in the order timeline.',
  })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  note?: string;
}
