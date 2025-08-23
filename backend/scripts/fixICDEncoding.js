const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Function to fix common UTF-8 to Latin-1 encoding issues
function fixEncoding(text) {
  if (!text) return text;
  
  return text
    // German umlauts
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    // French accents
    .replace(/Ã¢/g, 'â')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã®/g, 'î')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã /g, 'à')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã±/g, 'ñ')
    // Other common patterns
    .replace(/â€"/g, '–')
    .replace(/â€"/g, '—')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€¢/g, '•')
    .replace(/â€¦/g, '...')
    .replace(/Â°/g, '°')
    .replace(/Â±/g, '±')
    .replace(/Â²/g, '²')
    .replace(/Â³/g, '³')
    .replace(/Âµ/g, 'µ')
    .replace(/Â§/g, '§');
}

async function fixICDEncoding() {
  try {
    console.log('Starting ICD encoding fix...');
    
    // Get all ICD codes with encoding issues
    const problematicCodes = await prisma.iCDCode.findMany({
      where: {
        OR: [
          { label: { contains: 'Ã' } },
          { label: { contains: 'Â' } },
          { label: { contains: 'â€' } }
        ]
      }
    });
    
    console.log(`Found ${problematicCodes.length} ICD codes with encoding issues`);
    
    if (problematicCodes.length === 0) {
      console.log('No encoding issues found!');
      return;
    }
    
    // Show samples before fixing
    console.log('\nSample problematic labels:');
    problematicCodes.slice(0, 5).forEach(code => {
      console.log(`  ${code.icdCode}: ${code.label}`);
    });
    
    // Fix each code
    let fixedCount = 0;
    for (const code of problematicCodes) {
      const fixedLabel = fixEncoding(code.label);
      
      if (fixedLabel !== code.label) {
        await prisma.iCDCode.update({
          where: { id: code.id },
          data: { label: fixedLabel }
        });
        fixedCount++;
        
        if (fixedCount % 100 === 0) {
          console.log(`Fixed ${fixedCount} codes...`);
        }
      }
    }
    
    console.log(`\nFixed ${fixedCount} ICD code labels`);
    
    // Verify the fix
    console.log('\nVerifying fix...');
    const stillProblematic = await prisma.iCDCode.count({
      where: {
        OR: [
          { label: { contains: 'Ã' } },
          { label: { contains: 'Â' } }
        ]
      }
    });
    
    if (stillProblematic > 0) {
      console.log(`Warning: ${stillProblematic} codes still have encoding issues`);
    } else {
      console.log('✅ All encoding issues fixed!');
    }
    
    // Show some fixed samples
    const fixedSamples = await prisma.iCDCode.findMany({
      where: {
        label: {
          contains: 'Lymphknotenvergrößerung'
        }
      },
      take: 3
    });
    
    console.log('\nFixed samples:');
    fixedSamples.forEach(code => {
      console.log(`  ${code.icdCode}: ${code.label}`);
    });
    
  } catch (error) {
    console.error('Error fixing encoding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
console.log('ICD Encoding Fix Script');
console.log('=' .repeat(50));
fixICDEncoding()
  .then(() => console.log('\nEncoding fix completed'))
  .catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
  });