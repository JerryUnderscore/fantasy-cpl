// prisma.config.ts
import { defineConfig, env } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // This must exist or `prisma migrate dev` will fail with:
    // "The datasource.url property is required..."
    url: env("DATABASE_URL"),
  },
});