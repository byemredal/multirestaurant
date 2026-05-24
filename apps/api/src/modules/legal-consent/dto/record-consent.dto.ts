import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CONSENT_ACTIONS,
  CONSENT_CHANNELS,
  ConsentAction,
  ConsentChannel,
} from '../entities/consent-event.entity';

export class RecordConsentEntryDto {
  @ApiProperty({ description: 'PlatformLegalDocumentVersion.id being accepted.' })
  @IsUUID('4')
  documentVersionId!: string;

  @ApiPropertyOptional({ enum: CONSENT_ACTIONS, default: 'granted' })
  @IsOptional()
  @IsIn(CONSENT_ACTIONS)
  action?: ConsentAction;

  @ApiPropertyOptional({
    description: 'Optional context reference (e.g. orderId, applicationId).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  contextRef?: string;
}

export class RecordConsentDto {
  @ApiProperty({ enum: CONSENT_CHANNELS, default: 'web' })
  @IsIn(CONSENT_CHANNELS)
  channel!: ConsentChannel;

  @ApiProperty({
    description: 'One or more consent entries to record atomically.',
    type: [RecordConsentEntryDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RecordConsentEntryDto)
  entries!: RecordConsentEntryDto[];

  @ApiPropertyOptional({
    description:
      'Anonymous identifier (e.g. cookie hash). Required when caller is not authenticated.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  anonymousIdentifier?: string;
}
