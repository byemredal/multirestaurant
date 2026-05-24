import { PartialType } from '@nestjs/swagger';
import { CreateStoreSliderItemDto } from './create-store-slider-item.dto';

export class UpdateStoreSliderItemDto extends PartialType(CreateStoreSliderItemDto) {}
