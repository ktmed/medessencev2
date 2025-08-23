const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function loadAllMedicalCases() {
  try {
    console.log('Loading all medical cases from Excel file...');
    
    // Clear existing medical cases
    console.log('Clearing existing medical cases...');
    await prisma.medicalCase.deleteMany({});
    console.log('Existing cases cleared');
    
    // Read Excel file
    const filePath = '/Users/keremtomak/Documents/work/development/REPOS/med-essence/development/experiments/testcode/latestcompleteexplanations3.xlsx';
    console.log('Reading Excel file from:', filePath);
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log(`Found ${data.length} rows in Excel file`);
    
    // Get headers (first row)
    const headers = data[0];
    console.log('Headers:', headers.slice(0, 10));
    
    // Find column indices
    const columnIndices = {
      patientSex: headers.indexOf('PatientSex'),
      caseAgeClass: headers.indexOf('CaseAgeClass'),
      examServiceId: headers.indexOf('ExamServiceID'),  // Note: uppercase ID
      examDescription: headers.indexOf('ExamDescription'),
      examDate: headers.indexOf('ExamDate'),
      icdCode: headers.indexOf('ICD_Code'),  // Changed from ICD_Explanation
      reportText: headers.indexOf('ReportText')  // Changed from Clean_Report_Text_woCD
    };
    
    console.log('Column indices:', columnIndices);
    
    // Process in batches for better performance
    const BATCH_SIZE = 1000;
    let totalProcessed = 0;
    let totalInserted = 0;
    
    for (let i = 1; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length));
      const records = [];
      
      for (const row of batch) {
        // Skip rows without report text
        if (!row[columnIndices.reportText]) {
          continue;
        }
        
        // Parse exam date if available
        let examDate = null;
        if (row[columnIndices.examDate]) {
          try {
            // Excel serial date to JavaScript Date
            if (typeof row[columnIndices.examDate] === 'number') {
              examDate = new Date((row[columnIndices.examDate] - 25569) * 86400 * 1000);
            } else {
              examDate = new Date(row[columnIndices.examDate]);
            }
            
            // Validate date
            if (isNaN(examDate.getTime())) {
              examDate = null;
            }
          } catch (e) {
            examDate = null;
          }
        }
        
        const record = {
          patientSex: row[columnIndices.patientSex] ? String(row[columnIndices.patientSex]) : null,
          caseAgeClass: row[columnIndices.caseAgeClass] ? String(row[columnIndices.caseAgeClass]) : null,
          examServiceId: row[columnIndices.examServiceId] ? String(row[columnIndices.examServiceId]) : null,
          examDescription: row[columnIndices.examDescription] || null,
          examDate: examDate,
          icdCode: row[columnIndices.icdCode] || null,
          reportText: row[columnIndices.reportText]
        };
        
        records.push(record);
      }
      
      if (records.length > 0) {
        // Insert batch
        try {
          await prisma.medicalCase.createMany({
            data: records,
            skipDuplicates: true
          });
          totalInserted += records.length;
        } catch (error) {
          console.error(`Error inserting batch starting at row ${i}:`, error.message);
          // Try inserting records one by one for this batch
          for (const record of records) {
            try {
              await prisma.medicalCase.create({ data: record });
              totalInserted++;
            } catch (e) {
              // Skip this record
            }
          }
        }
      }
      
      totalProcessed = i + batch.length - 1;
      
      // Progress update
      if (totalProcessed % 10000 === 0 || totalProcessed === data.length - 1) {
        const percentage = ((totalProcessed / (data.length - 1)) * 100).toFixed(1);
        console.log(`Progress: ${totalProcessed}/${data.length - 1} rows (${percentage}%) - Inserted: ${totalInserted}`);
      }
    }
    
    // Final statistics
    const finalCount = await prisma.medicalCase.count();
    console.log('\n=== Loading Complete ===');
    console.log(`Total rows processed: ${totalProcessed}`);
    console.log(`Total records inserted: ${totalInserted}`);
    console.log(`Final count in database: ${finalCount}`);
    
    // Sample verification
    const samples = await prisma.medicalCase.findMany({ take: 3 });
    console.log('\nSample records:');
    samples.forEach((sample, index) => {
      console.log(`\n${index + 1}. ID: ${sample.id}`);
      console.log(`   ICD: ${sample.icdCode}`);
      console.log(`   Exam: ${sample.examDescription}`);
      console.log(`   Report preview: ${sample.reportText.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('Error loading medical cases:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the loader
console.log('Starting medical case loader...');
console.log('This will load ALL 189,461 medical cases.');
console.log('Estimated time: 5-10 minutes\n');

loadAllMedicalCases()
  .then(() => console.log('\nLoader completed successfully'))
  .catch(error => {
    console.error('Loader failed:', error);
    process.exit(1);
  });