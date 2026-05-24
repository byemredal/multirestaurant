import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StoreStatus } from '../entities/store.entity';

/** Query filters for the read-only platform-wide admin store list. */
export class ListAdminStoresDto {
  @ApiPropertyOptional({ enum: StoreStatus, example: StoreStatus.ACTIVE })
  @IsEnum(StoreStatus)
  @IsOptional()
  status?: StoreStatus;
}
