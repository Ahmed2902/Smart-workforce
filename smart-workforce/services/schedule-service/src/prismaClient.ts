import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  schedulePrisma?: PrismaClient;
};

const prisma =
  globalForPrisma.schedulePrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.schedulePrisma = prisma;
}

export default prisma;
