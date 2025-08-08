import { Language, LanguageOption } from '@/types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

export const getLanguageName = (code: Language): string => {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  return language?.name || code;
};

export const getLanguageFlag = (code: Language): string => {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  return language?.flag || '🌐';
};

export const isValidLanguage = (code: string): code is Language => {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
};

// Medical terminology translations
export const MEDICAL_TERMS = {
  findings: {
    de: 'Befunde',
    en: 'Findings',
    fr: 'Résultats',
    es: 'Hallazgos',
    it: 'Risultati',
    tr: 'Bulgular',
  },
  impression: {
    de: 'Beurteilung',
    en: 'Impression',
    fr: 'Impression',
    es: 'Impresión',
    it: 'Impressione',
    tr: 'İzlenim',
  },
  recommendations: {
    de: 'Empfehlungen',
    en: 'Recommendations',
    fr: 'Recommandations',
    es: 'Recomendaciones',
    it: 'Raccomandazioni',
    tr: 'Öneriler',
  },
  summary: {
    de: 'Zusammenfassung',
    en: 'Summary',
    fr: 'Résumé',
    es: 'Resumen',
    it: 'Riassunto',
    tr: 'Özet',
  },
  recording: {
    de: 'Aufnahme',
    en: 'Recording',
    fr: 'Enregistrement',
    es: 'Grabación',
    it: 'Registrazione',
    tr: 'Kayıt',
  },
  transcription: {
    de: 'Transkription',
    en: 'Transcription',
    fr: 'Transcription',
    es: 'Transcripción',
    it: 'Trascrizione',
    tr: 'Transkripsiyon',
  },
  dashboard: {
    de: 'Medizinisches Dashboard',
    en: 'Medical Dashboard',
    fr: 'Tableau de Bord Médical',
    es: 'Panel Médico',
    it: 'Dashboard Medico',
    tr: 'Tıbbi Kontrol Paneli',
  },
  audioRecording: {
    de: 'Audio-Aufnahme',
    en: 'Audio Recording',
    fr: 'Enregistrement Audio',
    es: 'Grabación de Audio',
    it: 'Registrazione Audio',
    tr: 'Ses Kaydı',
  },
  liveTranscription: {
    de: 'Live-Transkription',
    en: 'Live Transcription',
    fr: 'Transcription en Direct',
    es: 'Transcripción en Vivo',
    it: 'Trascrizione dal Vivo',
    tr: 'Canlı Transkripsiyon',
  },
};

export const getMedicalTerm = (term: keyof typeof MEDICAL_TERMS, language: Language): string => {
  return MEDICAL_TERMS[term][language] || MEDICAL_TERMS[term]['en'];
};