import type { Language } from './i18n';

export type { Language } from './i18n';

export function formatUnit(unit: string, language: Language) {
  if (unit === 'ms') {
    return language === 'en' ? 'ms' : 'мс';
  }

  return unit;
}
