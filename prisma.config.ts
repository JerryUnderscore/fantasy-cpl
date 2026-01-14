import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    // Use the pooler URL (works on your network + Vercel)
    url: process.env.DATABASE_URL,
  },
  migrations: {
  seed: "npx tsx prisma/seed.ts",
},
});