const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  try {
    const url = process.argv[2] || 'http://127.0.0.1:5177/';
    const outDir = os.tmpdir();
    const screenshotPath = path.join(outDir, `musiclib_capture_${Date.now()}.png`);
    const consolePath = path.join(outDir, `musiclib_console_${Date.now()}.json`);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const logs = [];

    page.on('console', msg => {
      try {
        const text = msg.text();
        logs.push({ type: msg.type(), text });
        console.log('PAGE_CONSOLE:', msg.type(), text);
      } catch (e) { /* ignore */ }
    });

    page.on('pageerror', err => {
      try { logs.push({ type: 'pageerror', text: String(err) }); console.log('PAGE_ERROR:', String(err)); } catch (e) {}
    });

    page.on('requestfailed', req => {
      try { logs.push({ type: 'requestfailed', url: req.url(), failure: req.failure() && req.failure().errorText }); console.log('REQUEST_FAILED', req.url()); } catch(e) {}
    });

    console.log('NAVIGATING TO', url);
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => { console.log('GOTO_ERR', String(e)); return null; });
    if (res) console.log('NAV_STATUS', res.status());

  // give client JS a short moment to run
  await new Promise(res => setTimeout(res, 1500));

    const html = await page.content();
    try { fs.writeFileSync(path.join(outDir, `musiclib_page_${Date.now()}.html`), html, 'utf8'); } catch (e) {}

    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(e => console.log('SS_ERR', String(e)));
    try { fs.writeFileSync(consolePath, JSON.stringify(logs, null, 2), 'utf8'); } catch (e) {}

    console.log('SCREENSHOT_SAVED', screenshotPath);
    console.log('CONSOLE_SAVED', consolePath);
    console.log('LOG_COUNT', logs.length);

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('CAPTURE_ERROR', String(err));
    process.exit(2);
  }
})();
