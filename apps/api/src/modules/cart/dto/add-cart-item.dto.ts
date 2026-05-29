import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CartOptionSelectionDto } from './cart-option-selection.dto';

export class AddCartItemDto {
  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  @IsUUID('4')
  storeId: string;

  @ApiProperty({ example: 'e7da8e47-b4da-4a09-b3d3-13bca41787da' })
  @IsUUID('4')
  menuItemId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    type: () => [CartOptionSelectionDto],
    description: 'Selected option items grouped by their option group identifiers.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartOptionSelectionDto)
  @IsOptional()
  selectedOptions?: CartOptionSelectionDto[];

  @ApiPropertyOptional({
    enum: ['delivery', 'pickup'],
    description:
      'Preferred service type for a newly created cart, derived from the route/mode. Used only when the cart does not exist yet.',
  })
  @IsIn(['delivery', 'pickup'])
  @IsOptional()
  serviceType?: 'delivery' | 'pickup';
}
