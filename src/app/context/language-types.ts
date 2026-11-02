export type LanguageCode = 'en' | 'vi' | 'zh' | 'ja' | 'no' | 'es' | 'fr' | 'ko';

export interface Language {
  code: LanguageCode;
  label: string;
}
