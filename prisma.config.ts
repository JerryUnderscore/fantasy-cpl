// prisma.config.ts
import { defineConfig } from "prisma/config";
import "dotenv/config";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing DIRECT_URL or DATABASE_URL in environment for Prisma config.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // This must exist or `prisma migrate dev` will fail with:
    // "The datasource.url property is required..."
    url: databaseUrl,
  },
});
