// Manual mock for languages utilities
const SUPPORTED_LANGUAGES = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

const MEDICAL_TERMS = {
  findings: { de: 'Befunde', en: 'Findings' },
  impression: { de: 'Beurteilung', en: 'Impression' },
  recommendations: { de: 'Empfehlungen', en: 'Recommendations' },
  summary: { de: 'Zusammenfassung', en: 'Summary' }
};

module.exports = {
  SUPPORTED_LANGUAGES,
  MEDICAL_TERMS,
  getLanguageName: jest.fn((code) => {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
    return language?.name || code;
  }),
  getLanguageFlag: jest.fn((code) => {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
    return language?.flag || '🌐';
  }),
  isValidLanguage: jest.fn((code) => SUPPORTED_LANGUAGES.some(lang => lang.code === code)),
  getMedicalTerm: jest.fn((term, language) => {
    return MEDICAL_TERMS[term]?.[language] || MEDICAL_TERMS[term]?.['en'] || term;
  })
};