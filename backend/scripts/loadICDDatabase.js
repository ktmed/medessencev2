/**
 * Script to load ICD-10-GM database into PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const prisma = new PrismaClient();

const ICD_CSV_PATH = '/Users/keremtomak/Documents/work/development/REPOS/med-essence/data/icd/ICDdataexport/icd_meta_codes.csv';

async function loadICDCodes() {
  console.log('🔄 Starting ICD-10-GM database import...');
  
  // Clear existing data
  console.log('🗑️ Clearing existing ICD codes...');
  await prisma.iCDCode.deleteMany({});
  
  const records = [];
  let totalRows = 0;
  let skippedRows = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(ICD_CSV_PATH, { encoding: 'latin1' }) // Use latin1 encoding for German text
      .pipe(csv())
      .on('data', (row) => {
        totalRows++;
        
        try {
          // Parse the row data
          const record = {
            year: parseInt(row.year) || 2024,
            level: parseInt(row.level) || 0,
            terminal: row.terminal || 'N',
            icdCode: row.icd_code || row.icd_normcode,
            icdNormCode: row.icd_normcode || '',
            label: row.label || '',
            chapterNr: parseInt(row.chapter_nr) || 0,
            icdBlockFirst: row.icd_block_first || '',
            genderSpecific: row.gender_specific || '9',
            ageMin: row.age_min ? parseInt(row.age_min) : null,
            ageMax: row.age_max ? parseInt(row.age_max) : null,
            rareInCentralEurope: row.rare_in_central_europe || 'N',
            notifiable: row.notifiable || 'N'
          };
          
          // Skip invalid records
          if (!record.icdCode || !record.label) {
            skippedRows++;
            return;
          }
          
          records.push(record);
          
          // Batch insert every 1000 records
          if (records.length >= 1000) {
            console.log(`📦 Processing batch... ${totalRows} rows processed`);
          }
          
        } catch (error) {
          skippedRows++;
          // Skip rows with parsing errors
        }
      })
      .on('end', async () => {
        console.log(`\n📊 CSV parsing complete:`);
        console.log(`- Total rows: ${totalRows}`);
        console.log(`- Valid records: ${records.length}`);
        console.log(`- Skipped rows: ${skippedRows}`);
        
        // Insert records in batches
        console.log('\n💾 Inserting records into PostgreSQL...');
        const batchSize = 500;
        let inserted = 0;
        
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          
          // Use createMany with skipDuplicates to handle unique constraint
          try {
            const result = await prisma.iCDCode.createMany({
              data: batch,
              skipDuplicates: true
            });
            inserted += result.count;
            console.log(`✅ Inserted ${inserted}/${records.length} records`);
          } catch (error) {
            console.error(`❌ Error inserting batch at ${i}:`, error.message);
          }
        }
        
        console.log(`\n✅ Successfully loaded ${inserted} ICD codes into PostgreSQL`);
        resolve(inserted);
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV file:', error);
        reject(error);
      });
  });
}

async function main() {
  try {
    await loadICDCodes();
    
    // Verify the data
    const count = await prisma.iCDCode.count();
    console.log(`\n📊 Database verification: ${count} ICD codes in database`);
    
    // Show sample records
    const samples = await prisma.iCDCode.findMany({
      take: 5,
      where: {
        terminal: 'T'
      }
    });
    
    console.log('\n📋 Sample ICD codes:');
    samples.forEach(code => {
      console.log(`  ${code.icdCode}: ${code.label}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();