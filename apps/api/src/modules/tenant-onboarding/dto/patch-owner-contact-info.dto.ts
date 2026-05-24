import { PartialType } from '@nestjs/swagger';
import { UpdateTenantOwnerContactInfoDto } from './update-owner-contact-info.dto';

export class PatchTenantOwnerContactInfoDto extends PartialType(UpdateTenantOwnerContactInfoDto) {}
