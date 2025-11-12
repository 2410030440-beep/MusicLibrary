const puppeteer = require('puppeteer');
(async ()=>{
  const url = process.argv[2] || 'http://127.0.0.1:5177/';
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const requests = [];
  page.on('requestfinished', req => {
    requests.push({ url: req.url(), status: req.response()? req.response().status() : null, resourceType: req.resourceType() });
  });
  page.on('requestfailed', req => {
    requests.push({ url: req.url(), status: null, failure: req.failure() && req.failure().errorText, resourceType: req.resourceType() });
  });
  console.log('Navigating to', url);
  const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e=>{ console.error('GOTO_ERR', String(e)); process.exit(2); });
  console.log('NAV_STATUS', res && res.status());
  // allow some JS to run (use generic timeout for Puppeteer compatibility)
  await new Promise(res => setTimeout(res, 800));
  const result = await page.evaluate(()=>{
    function uniq(a){ return Array.from(new Set(a.filter(Boolean))); }
    const imgs = Array.from(document.querySelectorAll('img')).map(i=>i.src).filter(Boolean);
    const inlineBg = Array.from(document.querySelectorAll('[style]')).map(el=>{
      try { return window.getComputedStyle(el).backgroundImage; } catch(e){ return null; }
    }).filter(Boolean);
    // css background images via stylesheets (search all elements computed)
    const all = Array.from(document.querySelectorAll('*'));
    const computedBg = all.map(el=>{
      try { return window.getComputedStyle(el).backgroundImage; } catch(e){ return null; }
    }).filter(Boolean);
    return { imgs: uniq(imgs), inlineBg: uniq(inlineBg), computedBg: uniq(computedBg) };
  });
  console.log('IMAGES_FOUND');
  console.log(JSON.stringify(result, null, 2));
  console.log('NETWORK_REQUESTS (last 200)');
  const recent = requests.slice(-200);
  console.log(JSON.stringify(recent, null, 2));
  await browser.close();
  process.exit(0);
})();