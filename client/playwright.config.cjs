const {
  defineConfig,
} = require("/srv/dev/tools/browser/node_modules/@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  workers: 1,
  use: { browserName: "chromium", launchOptions: { chromiumSandbox: true } },
  outputDir: "./test-results",
});
