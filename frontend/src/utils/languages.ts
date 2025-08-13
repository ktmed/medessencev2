import { Language, LanguageOption } from '@/types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
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
    ar: 'النتائج',
    uk: 'Результати',
  },
  impression: {
    de: 'Beurteilung',
    en: 'Impression',
    fr: 'Impression',
    es: 'Impresión',
    it: 'Impressione',
    tr: 'İzlenim',
    ar: 'الانطباع',
    uk: 'Враження',
  },
  recommendations: {
    de: 'Empfehlungen',
    en: 'Recommendations',
    fr: 'Recommandations',
    es: 'Recomendaciones',
    it: 'Raccomandazioni',
    tr: 'Öneriler',
    ar: 'التوصيات',
    uk: 'Рекомендації',
  },
  summary: {
    de: 'Zusammenfassung',
    en: 'Summary',
    fr: 'Résumé',
    es: 'Resumen',
    it: 'Riassunto',
    tr: 'Özet',
    ar: 'ملخص',
    uk: 'Підсумок',
  },
  recording: {
    de: 'Aufnahme',
    en: 'Recording',
    fr: 'Enregistrement',
    es: 'Grabación',
    it: 'Registrazione',
    tr: 'Kayıt',
    ar: 'تسجيل',
    uk: 'Запис',
  },
  transcription: {
    de: 'Transkription',
    en: 'Transcription',
    fr: 'Transcription',
    es: 'Transcripción',
    it: 'Trascrizione',
    tr: 'Transkripsiyon',
    ar: 'نسخ',
    uk: 'Транскрипція',
  },
  dashboard: {
    de: 'Medizinisches Dashboard',
    en: 'Medical Dashboard',
    fr: 'Tableau de Bord Médical',
    es: 'Panel Médico',
    it: 'Dashboard Medico',
    tr: 'Tıbbi Kontrol Paneli',
    ar: 'لوحة التحكم الطبية',
    uk: 'Медична панель',
  },
  audioRecording: {
    de: 'Audio-Aufnahme',
    en: 'Audio Recording',
    fr: 'Enregistrement Audio',
    es: 'Grabación de Audio',
    it: 'Registrazione Audio',
    tr: 'Ses Kaydı',
    ar: 'تسجيل صوتي',
    uk: 'Аудіозапис',
  },
  liveTranscription: {
    de: 'Live-Transkription',
    en: 'Live Transcription',
    fr: 'Transcription en Direct',
    es: 'Transcripción en Vivo',
    it: 'Trascrizione dal Vivo',
    tr: 'Canlı Transkripsiyon',
    ar: 'نسخ مباشر',
    uk: 'Пряма транскрипція',
  },
  keyFindings: {
    de: 'Hauptbefunde',
    en: 'Key Findings',
    fr: 'Résultats Clés',
    es: 'Hallazgos Clave',
    it: 'Risultati Chiave',
    tr: 'Temel Bulgular',
    ar: 'النتائج الرئيسية',
    uk: 'Основні результати',
  },
  technicalDetails: {
    de: 'Technische Details',
    en: 'Technical Details',
    fr: 'Détails Techniques',
    es: 'Detalles Técnicos',
    it: 'Dettagli Tecnici',
    tr: 'Teknik Detaylar',
    ar: 'التفاصيل التقنية',
    uk: 'Технічні деталі',
  },
  medicalReport: {
    de: 'Medizinischer Bericht',
    en: 'Medical Report',
    fr: 'Rapport Médical',
    es: 'Informe Médico',
    it: 'Rapporto Medico',
    tr: 'Tıbbi Rapor',
    ar: 'التقرير الطبي',
    uk: 'Медичний звіт',
  },
  patientSummary: {
    de: 'Patientenfreundliche Medizinische Zusammenfassung',
    en: 'Patient-Friendly Medical Summary',
    fr: 'Résumé Médical Convivial pour le Patient',
    es: 'Resumen Médico Amigable para el Paciente',
    it: 'Riassunto Medico Amichevole per il Paziente',
    tr: 'Hasta Dostu Tıbbi Özet',
    ar: 'ملخص طبي ودود للمريض',
    uk: 'Дружній до пацієнта медичний підсумок',
  },
  reportId: {
    de: 'Bericht-ID',
    en: 'Report ID',
    fr: 'ID du Rapport',
    es: 'ID del Informe',
    it: 'ID Rapporto',
    tr: 'Rapor Kimliği',
    ar: 'معرف التقرير',
    uk: 'ID звіту',
  },
  summaryId: {
    de: 'Zusammenfassung-ID',
    en: 'Summary ID',
    fr: 'ID du Résumé',
    es: 'ID del Resumen',
    it: 'ID Riassunto',
    tr: 'Özet Kimliği',
    ar: 'معرف الملخص',
    uk: 'ID підсумку',
  },
  patientId: {
    de: 'Patienten-ID',
    en: 'Patient ID',
    fr: 'ID du Patient',
    es: 'ID del Paciente',
    it: 'ID Paziente',
    tr: 'Hasta Kimliği',
    ar: 'معرف المريض',
    uk: 'ID пацієнта',
  },
  generated: {
    de: 'Erstellt',
    en: 'Generated',
    fr: 'Généré',
    es: 'Generado',
    it: 'Generato',
    tr: 'Oluşturuldu',
    ar: 'تم الإنشاء',
    uk: 'Створено',
  },
  language: {
    de: 'Sprache',
    en: 'Language',
    fr: 'Langue',
    es: 'Idioma',
    it: 'Lingua',
    tr: 'Dil',
    ar: 'اللغة',
    uk: 'Мова',
  },
  noDataAvailable: {
    de: 'Keine Daten verfügbar',
    en: 'No data available',
    fr: 'Aucune donnée disponible',
    es: 'No hay datos disponibles',
    it: 'Nessun dato disponibile',
    tr: 'Veri mevcut değil',
    ar: 'لا توجد بيانات متاحة',
    uk: 'Немає доступних даних',
  },
  reviewWithProvider: {
    de: 'Diese Zusammenfassung wurde automatisch erstellt und sollte mit Ihrem Arzt besprochen werden.',
    en: 'This summary has been generated automatically and should be reviewed with your healthcare provider.',
    fr: 'Ce résumé a été généré automatiquement et devrait être examiné avec votre professionnel de santé.',
    es: 'Este resumen ha sido generado automáticamente y debe ser revisado con su proveedor de atención médica.',
    it: 'Questo riassunto è stato generato automaticamente e dovrebbe essere rivisto con il tuo fornitore di assistenza sanitaria.',
    tr: 'Bu özet otomatik olarak oluşturulmuştur ve sağlık hizmet sağlayıcınızla gözden geçirilmelidir.',
    ar: 'تم إنشاء هذا الملخص تلقائياً ويجب مراجعته مع مقدم الرعاية الصحية الخاص بك.',
    uk: 'Цей підсумок було створено автоматично і його слід переглянути з вашим лікарем.',
  },
};

export const getMedicalTerm = (term: keyof typeof MEDICAL_TERMS, language: Language): string => {
  return MEDICAL_TERMS[term][language] || MEDICAL_TERMS[term]['en'];
};