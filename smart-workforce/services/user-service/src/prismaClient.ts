import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  userPrisma?: PrismaClient;
};

const prisma =
  globalForPrisma.userPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.userPrisma = prisma;
}

export default prisma;
