const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixInvisibleChars() {
  try {
    console.log('Scanning for invisible characters in ICD codes...');
    
    // First check R59 codes specifically to diagnose the issue
    const r59 = await prisma.iCDCode.findMany({
      where: { icdCode: { startsWith: 'R59' } }
    });
    
    console.log('\nR59 codes BEFORE cleanup:');
    r59.forEach(c => {
      console.log(`  ${c.icdCode}: ${c.label}`);
      // Show hex for verification
      const hex = Buffer.from(c.label, 'utf8').toString('hex');
      console.log(`    Hex: ${hex}`);
      
      // Check for specific problematic bytes
      if (hex.includes('c29f')) {
        console.log('    ⚠️  Contains C2 9F (control character)');
      }
      if (hex.includes('c2a0')) {
        console.log('    ⚠️  Contains C2 A0 (non-breaking space)');
      }
    });
    
    // Get all ICD codes
    const codes = await prisma.iCDCode.findMany();
    
    let fixed = 0;
    for (const code of codes) {
      // Remove invisible characters
      // The main issue seems to be C2 9F which is being inserted
      let cleanLabel = code.label;
      
      // Check for the specific problematic sequence
      const hex = Buffer.from(code.label, 'utf8').toString('hex');
      if (hex.includes('c29f')) {
        // Replace the problematic byte sequence
        // C2 9F is Unicode U+009F (Application Program Command - a control character)
        cleanLabel = cleanLabel.replace(/\u009F/g, '');
        cleanLabel = cleanLabel.replace(/[\x80-\x9F]/g, ''); // Remove all control characters in this range
      }
      
      // Also clean other invisible characters
      cleanLabel = cleanLabel
        .replace(/\u00A0/g, ' ')  // Replace non-breaking space with regular space
        .replace(/\u200B/g, '')   // Remove zero-width space
        .replace(/\u00AD/g, '')   // Remove soft hyphen
        .replace(/\u2028/g, ' ')  // Replace line separator with space
        .replace(/\u2029/g, ' ')  // Replace paragraph separator with space
        .replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Remove all control characters
      
      if (cleanLabel !== code.label) {
        console.log(`\nFixing invisible chars in ${code.icdCode}:`);
        console.log(`  Original: '${code.label}'`);
        console.log(`  Cleaned:  '${cleanLabel}'`);
        
        await prisma.iCDCode.update({
          where: { id: code.id },
          data: { label: cleanLabel }
        });
        fixed++;
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} codes with invisible characters`);
    
    // Check R59 codes again after cleanup
    const r59After = await prisma.iCDCode.findMany({
      where: { icdCode: { startsWith: 'R59' } }
    });
    
    console.log('\nR59 codes AFTER cleanup:');
    r59After.forEach(c => {
      console.log(`  ${c.icdCode}: ${c.label}`);
      // Show hex for verification
      const hex = Buffer.from(c.label, 'utf8').toString('hex');
      console.log(`    Hex: ${hex}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

console.log('Invisible Character Fix Script');
console.log('=' .repeat(50));
fixInvisibleChars();