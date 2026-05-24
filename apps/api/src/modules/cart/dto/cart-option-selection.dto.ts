import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CartOptionSelectionDto {
  @ApiProperty({ example: '924331c8-ed1f-472b-889d-eaa2b9498c7f' })
  @IsUUID('4')
  optionGroupId: string;

  @ApiProperty({ example: '21e66e53-fc33-4406-9ed5-55e4c39aaa88' })
  @IsUUID('4')
  optionItemId: string;
}
