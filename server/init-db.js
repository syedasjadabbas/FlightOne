import { PrismaClient } from '@prisma/client';

async function initDb() {
  const adminPrisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:0786@localhost:5432/postgres?schema=public' } }
  });
  try {
    await adminPrisma.$connect();
    const dbs = await adminPrisma.$queryRawUnsafe("SELECT datname FROM pg_database WHERE datname = 'flight_one'");
    if (!dbs || dbs.length === 0) {
      console.log('Creating database flight_one...');
      await adminPrisma.$executeRawUnsafe('CREATE DATABASE flight_one');
      console.log('Database flight_one created successfully!');
    } else {
      console.log('Database flight_one already exists.');
    }
  } catch (err) {
    console.error('Error creating database:', err.message);
  } finally {
    await adminPrisma.$disconnect().catch(() => {});
  }
}
initDb();
