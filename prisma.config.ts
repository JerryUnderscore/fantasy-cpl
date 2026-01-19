import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Use DIRECT_URL for migrations
    url: process.env.DIRECT_URL!,
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});