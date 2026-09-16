import { PrismaClient } from '@prisma/client';

async function test() {
  const url = 'postgresql://postgres:0786@localhost:5432/postgres?schema=public';
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$connect();
    console.log('SUCCESS! CONNECTED TO POSTGRES WITH postgres:0786!');
  } catch (e) {
    console.error('Failed:', e.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
test();
