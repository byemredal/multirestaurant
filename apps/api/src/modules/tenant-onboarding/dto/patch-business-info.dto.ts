import { PartialType } from '@nestjs/swagger';
import { UpdateTenantBusinessInfoDto } from './update-business-info.dto';

export class PatchTenantBusinessInfoDto extends PartialType(UpdateTenantBusinessInfoDto) {}
