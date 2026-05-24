import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class BootstrapSampleStoreDto {
  @ApiProperty({
    description: 'Hangi örnek mağaza şablonunun yaratılacağı.',
    enum: ['pizza', 'burger', 'cafe'],
  })
  @IsIn(['pizza', 'burger', 'cafe'])
  template!: 'pizza' | 'burger' | 'cafe';
}
