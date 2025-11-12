const puppeteer = require('puppeteer');
(async ()=>{
  const url = process.argv[2] || 'http://127.0.0.1:5177/';
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
    try { console.log('PAGE_CONSOLE', msg.type(), msg.text()); } catch(e){}
  });
  page.on('pageerror', err => console.log('PAGE_ERROR', String(err)));
  const requests = [];
  page.on('requestfinished', req => {
    requests.push({ url: req.url(), status: req.response()? req.response().status() : null, resourceType: req.resourceType() });
  });
  page.on('requestfailed', req => {
    requests.push({ url: req.url(), status: null, failure: req.failure() && req.failure().errorText, resourceType: req.resourceType() });
  });
  console.log('Navigating to', url);
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e=>{ console.error('GOTO_ERR', String(e)); process.exit(2); });
  console.log('NAV_STATUS', res && res.status());
  // snapshot immediately
  const snapshot0 = await page.evaluate(()=>{
    try{
      const html = document.documentElement ? (document.documentElement.innerHTML || '').slice(0,2000) : '';
      const activePages = document.querySelectorAll ? Array.from(document.querySelectorAll('.page.active')).map(e=>e.id) : [];
      const navActive = document.querySelectorAll ? Array.from(document.querySelectorAll('.nav-link.active')).map(e=>e.dataset.page) : [];
      const bodyClass = document.body ? document.body.className : '';
      return { html, activePages, navActive, bodyClass };
    }catch(e){ return { html:'', activePages:[], navActive:[], bodyClass: '' }; }
  });
  console.log('SNAPSHOT_0', JSON.stringify(snapshot0, null, 2));
  // wait 900ms to catch race that hides page
  await new Promise(res=>setTimeout(res, 900));
  const snapshot1 = await page.evaluate(()=>{
    try{
      const html = document.documentElement ? (document.documentElement.innerHTML || '').slice(0,2000) : '';
      const activePages = document.querySelectorAll ? Array.from(document.querySelectorAll('.page.active')).map(e=>e.id) : [];
      const navActive = document.querySelectorAll ? Array.from(document.querySelectorAll('.nav-link.active')).map(e=>e.dataset.page) : [];
      const bodyClass = document.body ? document.body.className : '';
      return { html, activePages, navActive, bodyClass };
    }catch(e){ return { html:'', activePages:[], navActive:[], bodyClass: '' }; }
  });
  console.log('SNAPSHOT_1', JSON.stringify(snapshot1, null, 2));
  // Dump any debug traces stored by in-page tracers
  const traces = await page.evaluate(()=>{
    try{
      return {
        lastMutations: (()=>{ try { return JSON.parse(localStorage.getItem('ml_debug_lastMutations')||'[]'); } catch(e){ return localStorage.getItem('ml_debug_lastMutations'); } })(),
        mutations: (()=>{ try { return JSON.parse(localStorage.getItem('ml_debug_mutations')||'[]'); } catch(e){ return localStorage.getItem('ml_debug_mutations'); } })(),
        heartbeat: (()=>{ try { return JSON.parse(localStorage.getItem('ml_debug_heartbeat')||'[]'); } catch(e){ return localStorage.getItem('ml_debug_heartbeat'); } })(),
        stacks: (()=>{ try { return JSON.parse(localStorage.getItem('ml_debug_stack_traces')||'[]'); } catch(e){ return localStorage.getItem('ml_debug_stack_traces'); } })(),
        early: (()=>{ try { return JSON.parse(localStorage.getItem('ml_debug_early_traces')||'[]'); } catch(e){ return localStorage.getItem('ml_debug_early_traces'); } })()
      };
    }catch(e){ return { lastMutations:null, mutations:null, heartbeat:null, stacks:null } }
  });
  console.log('INPAGE_TRACES', JSON.stringify(traces, null, 2));
  // Try to collect any debug records written to localStorage by in-page tracers
  try {
    const stored = await page.evaluate(()=>{
      try{
        const muts = localStorage.getItem('ml_debug_mutations');
        const hb = localStorage.getItem('ml_debug_heartbeat');
        const stacks = localStorage.getItem('ml_debug_stack_traces');
        return { muts: muts ? JSON.parse(muts) : null, hb: hb ? JSON.parse(hb) : null, stacks: stacks ? JSON.parse(stacks) : null };
      }catch(e){ return { muts: null, hb: null, stacks: null }; }
    });
    console.log('LOCAL_DEBUG', JSON.stringify({ muts: Array.isArray(stored.muts) ? { len: stored.muts.length, tail: stored.muts.slice(-6) } : null, hb: Array.isArray(stored.hb) ? { len: stored.hb.length, tail: stored.hb.slice(-6) } : null, stacks: Array.isArray(stored.stacks) ? { len: stored.stacks.length, tail: stored.stacks.slice(-6) } : null }, null, 2));
  } catch(e){ console.log('LOCAL_DEBUG_ERR', String(e)); }
  console.log('REQUESTS', JSON.stringify(requests.slice(-100), null, 2));
  await browser.close();
  process.exit(0);
})();