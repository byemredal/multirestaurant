import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class UpdateTenantLegalTaxInfoDto {
  @ApiProperty({ example: 'Aegean Kitchens GmbH' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  legalEntityName: string;

  @ApiProperty({ example: 'TAX-123', required: false })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ example: 'VAT-123', required: false })
  @IsOptional()
  @IsString()
  vatId?: string;

  @ApiProperty({ example: 'DE' })
  @IsString()
  @IsNotEmpty()
  registrationCountry: string;

  @ApiProperty({ example: 'Example Street 42, Berlin' })
  @IsString()
  @IsNotEmpty()
  registeredAddress: string;
}
