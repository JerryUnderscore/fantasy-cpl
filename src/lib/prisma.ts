import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

function makePrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg({
    connectionString: url,
    max: 1,
    // idleTimeoutMillis: 10_000,
    // connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}

function getClient(): PrismaClient {
  // Cache the client in dev to survive hot reloads without opening new pools.
  if (process.env.NODE_ENV !== "production") {
    if (!globalForPrisma.prismaClient) {
      globalForPrisma.prismaClient = makePrisma();
    }
    return globalForPrisma.prismaClient;
  }

  // In production, lazily initialize once per runtime instance.
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = makePrisma();
  }
  return globalForPrisma.prismaClient;
}

// Export a PrismaClient-shaped object, but don’t instantiate until it’s actually used.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
