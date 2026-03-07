import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  attendancePrisma?: PrismaClient;
};

const prisma =
  globalForPrisma.attendancePrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.attendancePrisma = prisma;
}

export default prisma;
