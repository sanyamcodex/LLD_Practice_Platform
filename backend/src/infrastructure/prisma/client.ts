import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    try {
      console.log('[Prisma] Instantiating PrismaClient...');
      prismaClient = new PrismaClient();
      console.log('[Prisma] PrismaClient successfully instantiated.');
    } catch (err) {
      console.error('FATAL PRISMA CLIENT INSTANTIATION ERROR:', err);
      throw err;
    }
  }
  return prismaClient;
}

export async function checkDatabaseConnection(timeoutMs: number = 10000): Promise<void> {
  try {
    console.log('[Database] Checking database connection via PrismaClient...');
    const client = getPrismaClient();
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Database connection timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    await Promise.race([client.$connect(), timeoutPromise]);
    if (timer) clearTimeout(timer);
    console.log('[Database] Database connection established successfully.');
  } catch (err) {
    console.error('FATAL DATABASE CONNECTION / HEALTH-CHECK ERROR:', err);
    throw err;
  }
}
