import { PartialType } from '@nestjs/swagger';
import { CreateDiscountRuleDto } from './create-discount-rule.dto';

export class UpdateDiscountRuleDto extends PartialType(CreateDiscountRuleDto) {}
