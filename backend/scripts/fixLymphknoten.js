const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSpecificPattern() {
  try {
    console.log('Fixing specific encoding pattern for Lymphknotenvergrößerung...');
    
    // Get R59 codes specifically
    const r59codes = await prisma.iCDCode.findMany({
      where: {
        icdCode: {
          startsWith: 'R59'
        }
      }
    });
    
    console.log('Found', r59codes.length, 'R59 codes');
    
    for (const code of r59codes) {
      // Fix the specific pattern
      const fixedLabel = code.label.replace(/öÃerung/g, 'ößerung');
      
      if (fixedLabel !== code.label) {
        console.log(`Fixing: ${code.icdCode}: ${code.label} -> ${fixedLabel}`);
        await prisma.iCDCode.update({
          where: { id: code.id },
          data: { label: fixedLabel }
        });
      }
    }
    
    // Also fix other codes with this pattern
    const allProblematic = await prisma.iCDCode.findMany({
      where: {
        label: {
          contains: 'öÃ'
        }
      }
    });
    
    console.log('\nFound', allProblematic.length, 'codes with öÃ pattern');
    
    for (const code of allProblematic) {
      const fixedLabel = code.label.replace(/öÃerung/g, 'ößerung');
      
      if (fixedLabel !== code.label) {
        console.log(`Fixing: ${code.icdCode}: ${code.label} -> ${fixedLabel}`);
        await prisma.iCDCode.update({
          where: { id: code.id },
          data: { label: fixedLabel }
        });
      }
    }
    
    // Verify the fix
    console.log('\nVerifying R59 codes after fix:');
    const verifyR59 = await prisma.iCDCode.findMany({
      where: {
        icdCode: {
          startsWith: 'R59'
        }
      }
    });
    
    verifyR59.forEach(code => {
      console.log(`  ${code.icdCode}: ${code.label}`);
    });
    
    console.log('\n✅ Fixed specific pattern successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

console.log('Lymphknoten Encoding Fix');
console.log('=' .repeat(50));
fixSpecificPattern();