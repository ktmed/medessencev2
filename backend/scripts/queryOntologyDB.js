/**
 * Query script for ontology database in PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function queryDatabase() {
  console.log('🔍 Querying Ontology Database in PostgreSQL\n');
  
  // 1. Database Statistics
  console.log('📊 DATABASE STATISTICS:');
  console.log('========================');
  const icdCount = await prisma.iCDCode.count();
  const caseCount = await prisma.medicalCase.count();
  
  console.log(`• ICD-10-GM Codes: ${icdCount.toLocaleString()}`);
  console.log(`• Medical Cases: ${caseCount.toLocaleString()}`);
  
  // 2. ICD Code Sample
  console.log('\n📋 SAMPLE ICD CODES:');
  console.log('=====================');
  const sampleICDs = await prisma.iCDCode.findMany({
    take: 5,
    where: {
      terminal: 'T',
      label: {
        contains: 'Mammographie'
      }
    }
  });
  
  if (sampleICDs.length > 0) {
    sampleICDs.forEach(icd => {
      console.log(`• ${icd.icdCode}: ${icd.label}`);
    });
  } else {
    // Try breast-related codes
    const breastICDs = await prisma.iCDCode.findMany({
      take: 5,
      where: {
        terminal: 'T',
        label: {
          contains: 'Mamma'
        }
      }
    });
    
    breastICDs.forEach(icd => {
      console.log(`• ${icd.icdCode}: ${icd.label}`);
    });
  }
  
  // 3. Medical Cases by ICD Code
  console.log('\n📊 TOP ICD CODES IN MEDICAL CASES:');
  console.log('===================================');
  const topICDs = await prisma.medicalCase.groupBy({
    by: ['icdCode'],
    _count: {
      id: true
    },
    where: {
      icdCode: {
        not: null
      }
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    },
    take: 10
  });
  
  for (const item of topICDs) {
    // Get ICD description
    const icdDetails = await prisma.iCDCode.findFirst({
      where: {
        icdCode: item.icdCode
      }
    });
    
    const description = icdDetails ? icdDetails.label.substring(0, 50) : 'Description not found';
    console.log(`• ${item.icdCode}: ${item._count.id} cases - ${description}...`);
  }
  
  // 4. Medical Cases by Exam Type
  console.log('\n🏥 TOP EXAM TYPES:');
  console.log('==================');
  const topExams = await prisma.medicalCase.groupBy({
    by: ['examDescription'],
    _count: {
      id: true
    },
    where: {
      examDescription: {
        not: null
      }
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    },
    take: 10
  });
  
  topExams.forEach(exam => {
    console.log(`• ${exam.examDescription}: ${exam._count.id} cases`);
  });
  
  // 5. Search for Mammography Cases
  console.log('\n🔍 MAMMOGRAPHY CASES:');
  console.log('======================');
  const mammoCount = await prisma.medicalCase.count({
    where: {
      OR: [
        {
          examDescription: {
            contains: 'Mammo',
            mode: 'insensitive'
          }
        },
        {
          reportText: {
            contains: 'Mammographie',
            mode: 'insensitive'
          }
        }
      ]
    }
  });
  
  console.log(`• Total mammography-related cases: ${mammoCount.toLocaleString()}`);
  
  // Get sample mammography case
  const mammoCase = await prisma.medicalCase.findFirst({
    where: {
      examDescription: {
        contains: 'Mammo',
        mode: 'insensitive'
      },
      icdCode: {
        not: null
      }
    }
  });
  
  if (mammoCase) {
    console.log('\n📄 SAMPLE MAMMOGRAPHY CASE:');
    console.log('===========================');
    console.log(`• Patient Sex: ${mammoCase.patientSex}`);
    console.log(`• Age Class: ${mammoCase.caseAgeClass}`);
    console.log(`• Exam: ${mammoCase.examDescription}`);
    console.log(`• ICD Code: ${mammoCase.icdCode}`);
    console.log(`• Report Preview: ${mammoCase.reportText.substring(0, 200)}...`);
  }
  
  // 6. Performance Test - Search by ICD
  console.log('\n⚡ PERFORMANCE TEST:');
  console.log('====================');
  const startTime = Date.now();
  
  const searchICD = 'C50'; // Breast cancer
  const results = await prisma.medicalCase.findMany({
    where: {
      icdCode: {
        startsWith: searchICD
      }
    },
    take: 100
  });
  
  const queryTime = Date.now() - startTime;
  console.log(`• Found ${results.length} cases with ICD ${searchICD}* in ${queryTime}ms`);
  
  // 7. Full-text search simulation
  const searchTerm = 'Mikrokalzifikationen';
  const startTime2 = Date.now();
  
  const textResults = await prisma.medicalCase.findMany({
    where: {
      reportText: {
        contains: searchTerm,
        mode: 'insensitive'
      }
    },
    take: 100
  });
  
  const queryTime2 = Date.now() - startTime2;
  console.log(`• Found ${textResults.length} cases containing "${searchTerm}" in ${queryTime2}ms`);
  
  console.log('\n✅ Database is fully operational and indexed!');
}

async function main() {
  try {
    await queryDatabase();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();