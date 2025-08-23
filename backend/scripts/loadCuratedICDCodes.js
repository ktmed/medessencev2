/**
 * Curated ICD-10-GM loader for Heroku deployment
 * Loads essential medical codes for radiology and imaging
 * Handles German character encoding properly for PostgreSQL
 */

// Set proper encoding for German characters
process.env.LANG = 'de_DE.UTF-8';
process.env.LC_ALL = 'de_DE.UTF-8';

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma with proper UTF-8 handling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['info', 'warn', 'error']
});

/**
 * Map medical chapter names to ICD-10 chapter numbers
 */
function getChapterNumber(chapterName) {
  const chapterMap = {
    'Neoplasms': 2,
    'Genitourinary': 14,
    'Respiratory': 10,
    'Circulatory': 9,
    'Nervous': 6,
    'Musculoskeletal': 13,
    'Digestive': 11,
    'Symptoms': 18,
    'Injury': 19
  };
  return chapterMap[chapterName] || 1; // Default to chapter 1
}

function getChapterName(chapterNumber) {
  const chapterNames = {
    2: 'Neoplasms',
    6: 'Nervous',
    9: 'Circulatory',
    10: 'Respiratory', 
    11: 'Digestive',
    13: 'Musculoskeletal',
    14: 'Genitourinary',
    18: 'Symptoms',
    19: 'Injury'
  };
  return chapterNames[chapterNumber] || 'Unknown';
}

/**
 * Sanitize German medical text for proper database storage
 * Ensures UTF-8 encoding and removes problematic characters
 */
function sanitizeGermanText(text) {
  if (!text) return null;
  
  return text
    .trim()
    // Ensure proper German umlauts and special characters
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö') 
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã\u009f/g, 'ß')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã\u0096/g, 'Ö')
    .replace(/Ã\u009c/g, 'Ü')
    // Remove any control characters but keep German characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Curated ICD codes focused on radiology, imaging, and common medical conditions
const curatedICDCodes = [
  // Breast/Mammography Related
  { code: 'C50.0', description: 'Bösartige Neubildung: Brustwarze und Warzenhof', category: 'mammography', chapter: 'Neoplasms' },
  { code: 'C50.1', description: 'Bösartige Neubildung: Zentraler Drüsenkörper der Brustdrüse', category: 'mammography', chapter: 'Neoplasms' },
  { code: 'C50.2', description: 'Bösartige Neubildung: Oberer innerer Quadrant der Brustdrüse', category: 'mammography', chapter: 'Neoplasms' },
  { code: 'C50.3', description: 'Bösartige Neubildung: Unterer innerer Quadrant der Brustdrüse', category: 'mammography', chapter: 'Neoplasms' },
  { code: 'C50.4', description: 'Bösartige Neubildung: Oberer äußerer Quadrant der Brustdrüse', category: 'mammography', chapter: 'Neoplasms' },
  { code: 'C50.5', description: 'Bösartige Neubildung: Unterer äußerer Quadrant der Brustdrüse', category: 'mammography', chapter: 'Neoplasms' },
  { code: 'N60.0', description: 'Solitäre Zyste der Mamma', category: 'mammography', chapter: 'Genitourinary' },
  { code: 'N60.1', description: 'Diffuse zystische Mastopathie', category: 'mammography', chapter: 'Genitourinary' },
  { code: 'N60.2', description: 'Fibroadenose der Mamma', category: 'mammography', chapter: 'Genitourinary' },
  { code: 'N60.3', description: 'Fibrosierung der Mamma', category: 'mammography', chapter: 'Genitourinary' },
  { code: 'D24', description: 'Gutartige Neubildung der Brustdrüse', category: 'mammography', chapter: 'Neoplasms' },
  
  // Lung/Chest CT Related
  { code: 'C78.0', description: 'Sekundäre bösartige Neubildung der Lunge', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C34.0', description: 'Bösartige Neubildung: Hauptbronchus', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C34.1', description: 'Bösartige Neubildung: Oberlappen (-Bronchus)', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C34.2', description: 'Bösartige Neubildung: Mittellappen (-Bronchus)', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C34.3', description: 'Bösartige Neubildung: Unterlappen (-Bronchus)', category: 'ct', chapter: 'Neoplasms' },
  { code: 'J44.0', description: 'Chronische obstruktive Lungenkrankheit mit akuter Exazerbation', category: 'ct', chapter: 'Respiratory' },
  { code: 'J44.1', description: 'Chronische obstruktive Lungenkrankheit mit akuter Infektion der unteren Atemwege', category: 'ct', chapter: 'Respiratory' },
  { code: 'J18.0', description: 'Bronchopneumonie, nicht näher bezeichnet', category: 'ct', chapter: 'Respiratory' },
  { code: 'J18.1', description: 'Lobärpneumonie, nicht näher bezeichnet', category: 'ct', chapter: 'Respiratory' },
  { code: 'J18.2', description: 'Hypostatische Pneumonie, nicht näher bezeichnet', category: 'ct', chapter: 'Respiratory' },
  { code: 'J94.8', description: 'Sonstige näher bezeichnete Krankheiten der Pleura', category: 'ct', chapter: 'Respiratory' },
  
  // Brain/Head MRT Related
  { code: 'C71.0', description: 'Bösartige Neubildung: Zerebrum, ausgenommen Hirnlappen und Ventrikel', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C71.1', description: 'Bösartige Neubildung: Frontallappen', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C71.2', description: 'Bösartige Neubildung: Temporallappen', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C71.3', description: 'Bösartige Neubildung: Parietallappen', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C71.4', description: 'Bösartige Neubildung: Okzipitallappen', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'I63.0', description: 'Hirninfarkt durch Thrombose präzerebraler Arterien', category: 'mrt', chapter: 'Circulatory' },
  { code: 'I63.1', description: 'Hirninfarkt durch Embolie präzerebraler Arterien', category: 'mrt', chapter: 'Circulatory' },
  { code: 'I63.2', description: 'Hirninfarkt durch nicht näher bezeichneten Verschluss oder Stenose präzerebraler Arterien', category: 'mrt', chapter: 'Circulatory' },
  { code: 'I63.3', description: 'Hirninfarkt durch Thrombose zerebraler Arterien', category: 'mrt', chapter: 'Circulatory' },
  { code: 'I63.4', description: 'Hirninfarkt durch Embolie zerebraler Arterien', category: 'mrt', chapter: 'Circulatory' },
  { code: 'I61.0', description: 'Intrazerebrale Blutung in die Großhirnhemisphäre, subkortikal', category: 'mrt', chapter: 'Circulatory' },
  { code: 'I61.1', description: 'Intrazerebrale Blutung in die Großhirnhemisphäre, kortikal', category: 'mrt', chapter: 'Circulatory' },
  { code: 'G93.1', description: 'Anoxische Hirnschädigung, anderenorts nicht klassifiziert', category: 'mrt', chapter: 'Nervous' },
  
  // Spine/Orthopedic MRT Related
  { code: 'M51.0', description: 'Lumbale und sonstige Bandscheibenschäden mit Myelopathie', category: 'mrt', chapter: 'Musculoskeletal' },
  { code: 'M51.1', description: 'Lumbale und sonstige Bandscheibenschäden mit Radikulopathie', category: 'mrt', chapter: 'Musculoskeletal' },
  { code: 'M51.2', description: 'Sonstige näher bezeichnete Bandscheibendegeneration', category: 'mrt', chapter: 'Musculoskeletal' },
  { code: 'M51.3', description: 'Sonstige näher bezeichnete Bandscheibendegeneration', category: 'mrt', chapter: 'Musculoskeletal' },
  { code: 'M48.0', description: 'Spinalkanalstenose', category: 'mrt', chapter: 'Musculoskeletal' },
  { code: 'M47.0', description: 'Wirbelkörper-Wirbelkörper-Fusion', category: 'mrt', chapter: 'Musculoskeletal' },
  { code: 'M47.1', description: 'Sonstige Spondylose mit Myelopathie', category: 'mrt', chapter: 'Musculoskeletal' },
  { code: 'M47.2', description: 'Sonstige Spondylose mit Radikulopathie', category: 'mrt', chapter: 'Musculoskeletal' },
  
  // Abdominal/Gastrointestinal CT Related
  { code: 'C78.6', description: 'Sekundäre bösartige Neubildung des Retroperitoneums und des Peritoneums', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C25.0', description: 'Bösartige Neubildung: Pankreaskopf', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C25.1', description: 'Bösartige Neubildung: Pankreaskörper', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C25.2', description: 'Bösartige Neubildung: Pankreasschwanz', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C22.0', description: 'Leberzellkarzinom', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C22.1', description: 'Intrahepatisches Gallengangskarzinom', category: 'ct', chapter: 'Neoplasms' },
  { code: 'K80.0', description: 'Gallenblasenstein mit akuter Cholezystitis', category: 'ct', chapter: 'Digestive' },
  { code: 'K80.1', description: 'Gallenblasenstein mit sonstiger Cholezystitis', category: 'ct', chapter: 'Digestive' },
  { code: 'K80.2', description: 'Gallenblasenstein ohne Cholezystitis', category: 'ct', chapter: 'Digestive' },
  { code: 'K85.0', description: 'Idiopathische akute Pankreatitis', category: 'ct', chapter: 'Digestive' },
  { code: 'K85.1', description: 'Biliäre akute Pankreatitis', category: 'ct', chapter: 'Digestive' },
  
  // Cardiac/Thoracic Related
  { code: 'I25.0', description: 'Atherosklerotische Herz-Kreislauf-Krankheit, so beschrieben', category: 'ct', chapter: 'Circulatory' },
  { code: 'I25.1', description: 'Atherosklerotische Herzkrankheit', category: 'ct', chapter: 'Circulatory' },
  { code: 'I21.0', description: 'Akuter transmuraler Myokardinfarkt der Vorderwand', category: 'ct', chapter: 'Circulatory' },
  { code: 'I21.1', description: 'Akuter transmuraler Myokardinfarkt der Hinterwand', category: 'ct', chapter: 'Circulatory' },
  { code: 'I21.2', description: 'Akuter transmuraler Myokardinfarkt an sonstigen Lokalisationen', category: 'ct', chapter: 'Circulatory' },
  { code: 'I48.0', description: 'Vorhofflimmern, paroxysmal', category: 'ct', chapter: 'Circulatory' },
  { code: 'I48.1', description: 'Vorhofflimmern, persistierend', category: 'ct', chapter: 'Circulatory' },
  
  // Urological/Renal
  { code: 'C64', description: 'Bösartige Neubildung der Niere, ausgenommen Nierenbecken', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C65', description: 'Bösartige Neubildung des Nierenbeckens', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C67.0', description: 'Bösartige Neubildung: Trigonum vesicae', category: 'ct', chapter: 'Neoplasms' },
  { code: 'C67.1', description: 'Bösartige Neubildung: Apex vesicae', category: 'ct', chapter: 'Neoplasms' },
  { code: 'N20.0', description: 'Nierenstein', category: 'ct', chapter: 'Genitourinary' },
  { code: 'N20.1', description: 'Ureterstein', category: 'ct', chapter: 'Genitourinary' },
  { code: 'N20.2', description: 'Nierenstein und Ureterstein gleichzeitig', category: 'ct', chapter: 'Genitourinary' },
  
  // Gynecological/Pelvic
  { code: 'C53.0', description: 'Bösartige Neubildung: Endozervix', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C53.1', description: 'Bösartige Neubildung: Exozervix', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C54.0', description: 'Bösartige Neubildung: Isthmus uteri', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C54.1', description: 'Bösartige Neubildung: Endometrium', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'C56', description: 'Bösartige Neubildung des Ovars', category: 'mrt', chapter: 'Neoplasms' },
  { code: 'N80.0', description: 'Endometriose des Uterus', category: 'mrt', chapter: 'Genitourinary' },
  { code: 'N80.1', description: 'Endometriose des Ovars', category: 'mrt', chapter: 'Genitourinary' },
  
  // Common General Codes
  { code: 'R06.0', description: 'Dyspnoe', category: 'general', chapter: 'Symptoms' },
  { code: 'R06.2', description: 'Keuchen', category: 'general', chapter: 'Symptoms' },
  { code: 'R50.9', description: 'Fieber, nicht näher bezeichnet', category: 'general', chapter: 'Symptoms' },
  { code: 'R51', description: 'Kopfschmerz', category: 'general', chapter: 'Symptoms' },
  { code: 'R10.0', description: 'Akutes Abdomen', category: 'general', chapter: 'Symptoms' },
  { code: 'R10.1', description: 'Schmerzen im Bereich des Oberbauches', category: 'general', chapter: 'Symptoms' },
  { code: 'R10.2', description: 'Schmerzen im Beckenbereich und am Damm', category: 'general', chapter: 'Symptoms' },
  { code: 'R10.3', description: 'Schmerzen im Bereich des Unterbauches', category: 'general', chapter: 'Symptoms' },
  { code: 'R10.4', description: 'Sonstige und nicht näher bezeichnete Bauchschmerzen', category: 'general', chapter: 'Symptoms' },
  
  // Trauma/Emergency
  { code: 'S06.0', description: 'Commotio cerebri', category: 'ct', chapter: 'Injury' },
  { code: 'S06.1', description: 'Traumatisches Hirnödem', category: 'ct', chapter: 'Injury' },
  { code: 'S06.2', description: 'Diffuse Hirnverletzung', category: 'ct', chapter: 'Injury' },
  { code: 'S27.0', description: 'Traumatischer Pneumothorax', category: 'ct', chapter: 'Injury' },
  { code: 'S27.1', description: 'Traumatischer Hämatothorax', category: 'ct', chapter: 'Injury' },
  { code: 'S32.0', description: 'Fraktur eines Lendenwirbels', category: 'ct', chapter: 'Injury' },
  { code: 'S72.0', description: 'Schenkelhalsfraktur', category: 'ct', chapter: 'Injury' },
  { code: 'S72.1', description: 'Pertrochantäre Fraktur', category: 'ct', chapter: 'Injury' },
];

async function loadCuratedICDCodes() {
  try {
    console.log('🔄 Starting curated ICD-10-GM database import...');
    console.log(`📊 Loading ${curatedICDCodes.length} essential medical codes for radiology and imaging`);
    
    // Clear existing data
    console.log('🗑️ Clearing existing ICD codes...');
    await prisma.iCDCode.deleteMany({});
    console.log('✅ Existing codes cleared');
    
    // Prepare records for batch insertion with proper encoding and schema fields
    const records = curatedICDCodes.map(icd => ({
      year: 2024,
      level: icd.code.includes('.') ? 4 : 3,
      terminal: 'T', // T=Terminal, N=Non-terminal
      icdCode: sanitizeGermanText(icd.code),
      icdNormCode: sanitizeGermanText(icd.code), // Same as icdCode for now
      label: sanitizeGermanText(icd.description),
      chapterNr: getChapterNumber(icd.chapter), 
      icdBlockFirst: sanitizeGermanText(icd.code.substring(0, 3)), // First 3 characters
      genderSpecific: '9', // 9 = not gender specific
      ageMin: null,
      ageMax: null,
      rareInCentralEurope: 'N',
      notifiable: 'N'
    }));
    
    // Log a sample record to verify encoding
    console.log('🔍 Sample record encoding check:');
    console.log('   Code:', records[0].icdCode);
    console.log('   Description:', records[0].label);
    console.log('   Encoding looks correct:', /[äöüßÄÖÜ]/.test(records[0].label));
    
    console.log('💾 Inserting curated ICD codes...');
    await prisma.iCDCode.createMany({
      data: records,
      skipDuplicates: true
    });
    
    // Verify insertion
    const finalCount = await prisma.iCDCode.count();
    console.log(`✅ Successfully loaded ${finalCount} ICD codes`);
    
    // Show statistics by chapter
    console.log('\n📋 ICD Codes by Medical Chapter:');
    
    const chapters = [2, 6, 9, 10, 11, 13, 14, 18, 19]; // Main chapter numbers
    for (const chapter of chapters) {
      const count = await prisma.iCDCode.count({
        where: { chapterNr: chapter }
      });
      if (count > 0) {
        const chapterName = getChapterName(chapter);
        console.log(`   Chapter ${chapter} (${chapterName}): ${count} codes`);
      }
    }
    
    // Sample verification
    console.log('\n🔍 Sample ICD codes loaded:');
    const samples = await prisma.iCDCode.findMany({ 
      take: 5,
      select: {
        icdCode: true,
        label: true,
        chapterNr: true
      }
    });
    
    samples.forEach((sample, index) => {
      const chapterName = getChapterName(sample.chapterNr);
      console.log(`   ${index + 1}. ${sample.icdCode} - ${sample.label} (Chapter ${sample.chapterNr}: ${chapterName})`);
    });
    
    console.log('\n✅ Curated ICD database successfully initialized!');
    console.log('🎯 Ready for medical ontology enhancement');
    
  } catch (error) {
    console.error('❌ Error loading curated ICD codes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the loader
console.log('🏥 MedEssence AI - Curated ICD Database Loader');
console.log('===============================================');
console.log('Loading essential ICD-10-GM codes for radiology and medical imaging...\n');

loadCuratedICDCodes()
  .then(() => {
    console.log('\n🎉 Curated ICD loader completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Curated ICD loader failed:', error);
    process.exit(1);
  });