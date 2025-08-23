const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function check() {
  const icdCount = await prisma.iCDCode.count();
  const caseCount = await prisma.medicalCase.count();
  
  console.log(`ICD Codes: ${icdCount}`);
  console.log(`Medical Cases: ${caseCount}`);
  
  await prisma.$disconnect();
}

check();