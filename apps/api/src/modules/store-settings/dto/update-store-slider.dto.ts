import { PartialType } from '@nestjs/swagger';
import { CreateStoreSliderDto } from './create-store-slider.dto';

export class UpdateStoreSliderDto extends PartialType(CreateStoreSliderDto) {}
