import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  await prisma.$connect();
  console.log('✓ Database connected!');
} catch (err) {
  console.error('✗ Connection failed:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
