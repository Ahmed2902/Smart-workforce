import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  authPrisma?: PrismaClient;
};

const prisma =
  globalForPrisma.authPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.authPrisma = prisma;
}

export default prisma;
