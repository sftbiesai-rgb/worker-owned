import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
await page.goto('file://' + path.resolve(__dirname, '2-white-clean.html'));

// Remove the scale transform for the screenshot
await page.evaluate(() => {
  document.querySelector('.card').style.transform = 'none';
  document.body.style.width = '1080px';
  document.body.style.height = '1080px';
});

const card = await page.$('.card');
await card.screenshot({ path: path.resolve(__dirname, 'workerowned-promo.jpg'), type: 'jpeg', quality: 95 });
await browser.close();
console.log('Saved workerowned-promo.jpg');
