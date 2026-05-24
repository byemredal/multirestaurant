import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';

const sliderTypes = ['homepage', 'campaign', 'seasonal'] as const;

export class CreateStoreSliderDto {
  @ApiProperty({ example: 'Homepage Hero' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ enum: sliderTypes, example: 'homepage' })
  @IsIn(sliderTypes)
  sliderType!: (typeof sliderTypes)[number];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
