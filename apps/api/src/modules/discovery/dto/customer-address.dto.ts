import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Create a persistent delivery address for the authenticated customer. */
export class CreateCustomerAddressDto {
  @ApiPropertyOptional({ description: 'Friendly label.', example: 'Home' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  label?: string;

  @ApiPropertyOptional({ example: 'Anna Müller' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  recipientName?: string;

  @ApiPropertyOptional({ example: '+41 79 123 45 67' })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  contactPhone?: string;

  @ApiProperty({ description: 'ISO-3166-1 alpha-2 country code.', example: 'CH' })
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode!: string;

  @ApiPropertyOptional({ description: 'Canton / state.', example: 'Zug' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  canton?: string;

  @ApiProperty({ example: 'Zug' })
  @IsString()
  @Length(1, 120)
  city!: string;

  @ApiProperty({ example: '6300' })
  @IsString()
  @Matches(/^[0-9A-Za-z -]{3,12}$/)
  postalCode!: string;

  @ApiPropertyOptional({ example: 'Bahnhofstrasse' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  street?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  houseNumber?: string;

  @ApiPropertyOptional({ description: 'Apartment, floor, c/o.', example: '3. OG' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 47.1662 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 8.5154 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'Bahnhofstrasse 12, 6300 Zug' })
  @IsOptional()
  @IsString()
  @Length(1, 240)
  formattedAddress?: string;

  @ApiPropertyOptional({ description: 'Courier instructions.', example: 'Ring twice.' })
  @IsOptional()
  @IsString()
  @Length(1, 280)
  deliveryNotes?: string;

  @ApiPropertyOptional({ description: 'Mark this address as the default.' })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/** Update an existing customer address — every field optional. */
export class UpdateCustomerAddressDto extends PartialType(CreateCustomerAddressDto) {}
