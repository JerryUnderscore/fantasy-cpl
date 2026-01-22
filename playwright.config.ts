import { defineConfig } from "next/experimental/testmode/playwright";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3000",
    env: {
      NEXT_PUBLIC_MY_TEAMS_TEST_MODE: "1",
      NEXT_PUBLIC_LEAGUES_TEST_MODE: "1",
    },
  },
});
