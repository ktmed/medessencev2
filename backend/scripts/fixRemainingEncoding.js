const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// More comprehensive fixing patterns
function fixEncoding(text) {
  if (!text) return text;
  
  // Special patterns that need to be fixed first
  // These are double-encoded UTF-8 sequences
  text = text
    .replace(/Ã¶Ãerung/g, 'ößerung')  // Special case for größerung
    .replace(/abszeÃ/g, 'abszess')     // Special case for Abszess
    .replace(/biÃ/g, 'biss')           // Special case for Biss
    .replace(/Ã¶Ã/g, 'öß')             // General case for öß
    .replace(/grÃ¶Ãerung/g, 'größerung');
  
  return text
    // German umlauts
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    // Additional patterns
    .replace(/Ã¢/g, 'â')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ã®/g, 'î')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã /g, 'à')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã±/g, 'ñ');
}

async function fixRemaining() {
  try {
    console.log('Fixing remaining encoding issues...');
    
    // Get all codes that still have encoding issues
    const problematicCodes = await prisma.iCDCode.findMany({
      where: {
        OR: [
          { label: { contains: 'Ã' } },
          { label: { contains: 'Â' } },
          { label: { contains: 'â€' } }
        ]
      }
    });
    
    console.log(`Found ${problematicCodes.length} codes with remaining encoding issues`);
    
    // Show samples
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
    
    console.log(`\nFixed ${fixedCount} additional ICD code labels`);
    
    // Verify the R59 codes specifically
    console.log('\nVerifying R59 codes:');
    const r59codes = await prisma.iCDCode.findMany({
      where: {
        icdCode: {
          startsWith: 'R59'
        }
      }
    });
    
    r59codes.forEach(code => {
      console.log(`  ${code.icdCode}: ${code.label}`);
    });
    
    console.log('\n✅ Encoding fix completed successfully!');
    
  } catch (error) {
    console.error('Error fixing encoding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
console.log('Remaining Encoding Fix Script');
console.log('=' .repeat(50));
fixRemaining()
  .then(() => console.log('\nScript completed'))
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });