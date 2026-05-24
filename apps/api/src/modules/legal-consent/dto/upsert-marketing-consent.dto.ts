import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  MARKETING_CONSENT_ACTIONS,
  MARKETING_CONSENT_CHANNELS,
  MarketingConsentAction,
  MarketingConsentChannel,
} from '../entities/consent-event.entity';

export class MarketingConsentEntryDto {
  @ApiProperty({ enum: MARKETING_CONSENT_CHANNELS })
  @IsIn(MARKETING_CONSENT_CHANNELS)
  channel!: MarketingConsentChannel;

  @ApiProperty({ enum: MARKETING_CONSENT_ACTIONS })
  @IsIn(MARKETING_CONSENT_ACTIONS)
  action!: MarketingConsentAction;

  @ApiPropertyOptional({ description: 'Source / context (e.g. "registration", "settings-page").' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;
}

export class UpsertMarketingConsentDto {
  @ApiProperty({ type: [MarketingConsentEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => MarketingConsentEntryDto)
  entries!: MarketingConsentEntryDto[];
}
