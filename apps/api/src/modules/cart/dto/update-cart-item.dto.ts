import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { CartOptionSelectionDto } from './cart-option-selection.dto';

export class UpdateCartItemDto {
  @ApiPropertyOptional({ example: 3, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    type: () => [CartOptionSelectionDto],
    description: 'Replace the current option selection set for the cart line item.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartOptionSelectionDto)
  @IsOptional()
  selectedOptions?: CartOptionSelectionDto[];
}
