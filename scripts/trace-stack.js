// Lightweight MutationObserver to capture stack traces when root children are removed.
(function(){
  try {
    const key = 'ml_debug_stack_traces';
    const read = () => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } };
    const write = (v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch(e) {} };
    const tag = '[TRACE-STACK]';
    const store = read();
    const recentScripts = [];

    const pushRecentScript = (info) => {
      try {
        recentScripts.push(info);
        if (recentScripts.length > 40) recentScripts.shift();
      } catch (e) {}
    };

    const capture = (m) => {
        try {
          const targetName = m.target && m.target.nodeName;
          const removed = (m.removedNodes && m.removedNodes.length) || 0;
          const added = (m.addedNodes && m.addedNodes.length) || 0;
          if (!targetName) return null;

          // record any added <script> nodes for context
          if (m.addedNodes && m.addedNodes.length) {
            for (const n of m.addedNodes) {
              try {
                if (n && n.nodeType === Node.ELEMENT_NODE && n.nodeName === 'SCRIPT') {
                  const src = n.src || null;
                  const inline = (n.textContent || '').slice(0, 400);
                  pushRecentScript({ ts: Date.now(), src, inline });
                }
              } catch (e) {}
            }
          }

          // focus on removals that affect top-level containers
          if (removed > 0 && (targetName === 'BODY' || targetName === 'HTML' || targetName === 'MAIN' || targetName === 'DOCUMENT')) {
            const rawStack = (new Error()).stack || '';
            const frames = rawStack.split('\n').slice(2,10).map(s => s.trim());
            const recent = recentScripts.slice(-12);
            const entry = { ts: Date.now(), target: targetName, removed, added, frames, recentScripts: recent };
            store.push(entry);
            if (store.length > 120) store.shift();
            write(store);
            try { console.log(tag, entry); } catch(e) {}
            return entry;
          }
        } catch (e) { }
      return null;
    };

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        try { capture(m); } catch(e) {}
      }
    });

    try { obs.observe(document.documentElement || document, { childList: true, subtree: true }); } catch(e) {}

    // Disconnect after short period to avoid long-lived instrumentation
    setTimeout(() => { try { obs.disconnect(); } catch(e) {} }, 30000);
  } catch (e) { /* ignore */ }
})();
