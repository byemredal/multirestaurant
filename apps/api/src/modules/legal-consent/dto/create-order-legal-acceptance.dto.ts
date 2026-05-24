import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateOrderLegalAcceptanceDto {
  @ApiProperty({
    description: 'Order this acceptance attaches to. Must belong to the authenticated customer.',
  })
  @IsUUID('4')
  orderId!: string;

  @ApiProperty({
    description: 'PlatformLegalDocumentVersion.id for the active distance-sales contract.',
  })
  @IsUUID('4')
  distanceSalesContractVersionId!: string;

  @ApiProperty({
    description: 'PlatformLegalDocumentVersion.id for the active pre-information form.',
  })
  @IsUUID('4')
  preInformationFormVersionId!: string;
}
