import { PartialType } from '@nestjs/swagger';
import { UpdateTenantOperationsInfoDto } from './update-operations-info.dto';

export class PatchTenantOperationsInfoDto extends PartialType(UpdateTenantOperationsInfoDto) {}
