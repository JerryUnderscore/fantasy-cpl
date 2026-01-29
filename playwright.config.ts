import { defineConfig } from "next/experimental/testmode/playwright";

process.env.NEXT_PUBLIC_MY_TEAMS_TEST_MODE = "1";
process.env.NEXT_PUBLIC_LEAGUES_TEST_MODE = "1";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
});
