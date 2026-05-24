import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ReplaceStoreCuisinesDto {
  @ApiProperty({
    description: 'List of cuisine IDs to associate with the store.',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  cuisineIds!: string[];

  @ApiProperty({
    description:
      'Optional ID of the cuisine that should be flagged as primary. Must be a member of cuisineIds.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID('4')
  primaryCuisineId?: string;
}
