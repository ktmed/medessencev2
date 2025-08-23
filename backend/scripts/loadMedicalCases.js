/**
 * Script to load medical cases from Excel into PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

const EXCEL_PATH = '/Users/keremtomak/Documents/work/development/REPOS/med-essence/development/experiments/testcode/latestcompleteexplanations3.xlsx';

async function loadMedicalCases() {
  console.log('🔄 Starting medical cases import from Excel...');
  console.log(`📁 Reading file: ${EXCEL_PATH}`);
  
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(EXCEL_PATH, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false
    });
    
    console.log(`📊 Found ${jsonData.length} rows in Excel file`);
    
    // Get headers from first row
    const headers = jsonData[0];
    console.log('📋 Column headers:', headers);
    
    // Clear existing data
    console.log('🗑️ Clearing existing medical cases...');
    await prisma.medicalCase.deleteMany({});
    
    // Process data rows (skip header)
    const dataRows = jsonData.slice(1);
    console.log(`📦 Processing ${dataRows.length} data rows...`);
    
    const records = [];
    let skippedRows = 0;
    
    // Map Excel columns to database fields
    const columnMapping = {
      'PatientSex': 'patientSex',
      'CaseAgeClass': 'caseAgeClass',
      'ExamServiceID': 'examServiceId',
      'Order': 'order',
      'ExamDescription': 'examDescription',
      'ICD_Code': 'icdCode',
      'ReportText': 'reportText',
      'ExamDate': 'examDate',
      'ExamDescriptionDE': 'examDescriptionDE',
      'CaseOrderDE': 'caseOrderDE'
    };
    
    // Get column indices
    const columnIndices = {};
    headers.forEach((header, index) => {
      if (columnMapping[header]) {
        columnIndices[columnMapping[header]] = index;
      }
    });
    
    console.log('📍 Column mapping:', columnIndices);
    
    // Process each row
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // Skip empty rows
      if (!row || row.length === 0) {
        skippedRows++;
        continue;
      }
      
      try {
        const record = {
          patientSex: row[columnIndices.patientSex] ? String(row[columnIndices.patientSex]) : null,
          caseAgeClass: row[columnIndices.caseAgeClass] ? String(row[columnIndices.caseAgeClass]) : null,
          examServiceId: row[columnIndices.examServiceId] ? String(row[columnIndices.examServiceId]) : null,
          order: row[columnIndices.order] ? String(row[columnIndices.order]) : null,
          examDescription: row[columnIndices.examDescription] ? String(row[columnIndices.examDescription]) : null,
          examDescriptionDE: row[columnIndices.examDescriptionDE] ? String(row[columnIndices.examDescriptionDE]) : null,
          caseOrderDE: row[columnIndices.caseOrderDE] ? String(row[columnIndices.caseOrderDE]) : null,
          icdCode: row[columnIndices.icdCode] ? String(row[columnIndices.icdCode]) : null,
          reportText: row[columnIndices.reportText] ? String(row[columnIndices.reportText]) : '',
          examDate: row[columnIndices.examDate] instanceof Date ? row[columnIndices.examDate] : null
        };
        
        // Skip if no report text
        if (!record.reportText) {
          skippedRows++;
          continue;
        }
        
        records.push(record);
        
        // Show progress every 10000 records
        if ((i + 1) % 10000 === 0) {
          console.log(`📈 Processed ${i + 1}/${dataRows.length} rows...`);
        }
        
        // Limit for testing (remove this for full import)
        if (records.length >= 50000) {
          console.log('⚠️ Limiting to 50,000 records for initial import');
          break;
        }
        
      } catch (error) {
        skippedRows++;
        console.error(`Error processing row ${i}:`, error.message);
      }
    }
    
    console.log(`\n📊 Processing complete:`);
    console.log(`- Total rows: ${dataRows.length}`);
    console.log(`- Valid records: ${records.length}`);
    console.log(`- Skipped rows: ${skippedRows}`);
    
    // Insert records in batches
    console.log('\n💾 Inserting records into PostgreSQL...');
    const batchSize = 100; // Smaller batch size for larger records
    let inserted = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const result = await prisma.medicalCase.createMany({
          data: batch,
          skipDuplicates: false
        });
        inserted += result.count;
        
        if ((inserted % 5000) === 0) {
          console.log(`✅ Inserted ${inserted}/${records.length} records...`);
        }
      } catch (error) {
        console.error(`❌ Error inserting batch at ${i}:`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully loaded ${inserted} medical cases into PostgreSQL`);
    
    return inserted;
    
  } catch (error) {
    console.error('❌ Error loading Excel file:', error);
    throw error;
  }
}

async function main() {
  try {
    await loadMedicalCases();
    
    // Verify the data
    const count = await prisma.medicalCase.count();
    console.log(`\n📊 Database verification: ${count} medical cases in database`);
    
    // Show statistics
    const stats = await prisma.medicalCase.groupBy({
      by: ['examServiceId'],
      _count: {
        id: true
      },
      take: 10,
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    console.log('\n📊 Top 10 exam services:');
    stats.forEach(stat => {
      console.log(`  ${stat.examServiceId}: ${stat._count.id} cases`);
    });
    
    // Show sample records
    const samples = await prisma.medicalCase.findMany({
      take: 3,
      where: {
        icdCode: {
          not: null
        }
      }
    });
    
    console.log('\n📋 Sample medical cases:');
    samples.forEach(case_ => {
      console.log(`  ICD: ${case_.icdCode}, Exam: ${case_.examDescription}`);
      console.log(`    Report: ${case_.reportText.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();