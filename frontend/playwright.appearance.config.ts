import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',testMatch:['appearance.spec.ts','sorvo-glass.spec.ts'],workers:1,timeout:90000,
  outputDir:'../.cache/h6-appearance-results', reporter:[['list'],['json',{outputFile:'../.cache/h6-appearance/playwright.json'}]],
  use:{baseURL:'http://127.0.0.1:3128',browserName:'chromium',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'},reducedMotion:'reduce',trace:'off'},
  webServer:{command:'node tests/appearance-fixture.mjs',url:'http://127.0.0.1:3128/login',reuseExistingServer:false,timeout:30000},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}}],
});
