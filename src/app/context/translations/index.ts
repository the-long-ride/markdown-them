import type { LanguageCode } from '../language-types';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { no } from './no';
import { vi } from './vi';
import { zh } from './zh';

export const translations: Record<LanguageCode, Record<string, string>> = {
  en,
  vi,
  zh,
  ja,
  no,
  es,
  fr,
  ko,
};
