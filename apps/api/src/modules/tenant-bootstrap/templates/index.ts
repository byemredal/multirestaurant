import { burgerTemplate } from './burger.template';
import { cafeTemplate } from './cafe.template';
import { pizzaTemplate } from './pizza.template';
import { SampleTemplate, SampleTemplateKey } from './types';

export { SampleTemplate, SampleTemplateKey } from './types';

const TEMPLATES: Record<SampleTemplateKey, SampleTemplate> = {
  pizza: pizzaTemplate,
  burger: burgerTemplate,
  cafe: cafeTemplate,
};

export function getSampleTemplate(key: string): SampleTemplate | null {
  if (key in TEMPLATES) {
    return TEMPLATES[key as SampleTemplateKey];
  }
  return null;
}

export function listSampleTemplates(): SampleTemplate[] {
  return [pizzaTemplate, burgerTemplate, cafeTemplate];
}
