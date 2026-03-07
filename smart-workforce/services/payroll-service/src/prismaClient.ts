import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  payrollPrisma?: PrismaClient;
};

const prisma =
  globalForPrisma.payrollPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.payrollPrisma = prisma;
}

export default prisma;
