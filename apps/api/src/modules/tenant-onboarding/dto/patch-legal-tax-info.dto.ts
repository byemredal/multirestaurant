import { PartialType } from '@nestjs/swagger';
import { UpdateTenantLegalTaxInfoDto } from './update-legal-tax-info.dto';

export class PatchTenantLegalTaxInfoDto extends PartialType(UpdateTenantLegalTaxInfoDto) {}
