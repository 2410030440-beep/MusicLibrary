// Root-guard: defensive monkey-patches to prevent scripts from wiping the entire document
(function(){
  try {
    const KEY = 'ml_debug_root_guard';
    function pushRecord(r){ try{ const a = JSON.parse(localStorage.getItem(KEY)||'[]'); a.push(r); localStorage.setItem(KEY, JSON.stringify(a.slice(-80))); }catch(e){} }

    // Block document.write/open/close which can replace the page
    try {
      const origWrite = document.write && document.write.bind(document);
      document.write = function(){ try { pushRecord({ts:Date.now(), op:'document.write', args: Array.from(arguments).slice(0,3) }); console.warn('[GUARD] blocked document.write'); } catch(e){} };
      document.open = function(){ try{ pushRecord({ts:Date.now(), op:'document.open'}); console.warn('[GUARD] blocked document.open'); }catch(e){} };
      document.close = function(){ try{ pushRecord({ts:Date.now(), op:'document.close'}); console.warn('[GUARD] blocked document.close'); }catch(e){} };
    } catch(e) {}

    // Block attempts to remove or replace root-level elements
    try {
      const origRemove = Node.prototype.removeChild;
      Node.prototype.removeChild = function(child){
        try{
          if (!child) return origRemove.apply(this, arguments);
          const name = child.nodeName;
          if (name === 'HTML' || name === 'BODY' || child === document.documentElement || child === document.body) {
            pushRecord({ ts: Date.now(), op: 'removeChild_blocked', target: name || String(child) });
            console.warn('[GUARD] prevented removeChild on root element:', name);
            return child;
          }
        } catch(e){}
        return origRemove.apply(this, arguments);
      };

      const origReplace = Node.prototype.replaceChild;
      Node.prototype.replaceChild = function(newChild, oldChild){
        try{
          const name = oldChild && oldChild.nodeName;
          if (name === 'HTML' || name === 'BODY' || oldChild === document.documentElement || oldChild === document.body) {
            pushRecord({ ts: Date.now(), op: 'replaceChild_blocked', target: name || String(oldChild) });
            console.warn('[GUARD] prevented replaceChild on root element:', name);
            return oldChild;
          }
        } catch(e){}

      // Block replaceChildren (modern API) on root elements
      try {
        if (Element.prototype.replaceChildren) {
          const origReplaceChildren = Element.prototype.replaceChildren;
          Element.prototype.replaceChildren = function(){
            try{
              const name = this && this.nodeName;
              if (name === 'HTML' || name === 'BODY' || this === document.documentElement || this === document.body) {
                pushRecord({ ts: Date.now(), op: 'replaceChildren_blocked', target: name });
                console.warn('[GUARD] prevented replaceChildren on root element:', name);
                return;
              }
            }catch(e){}
            return origReplaceChildren.apply(this, arguments);
          };
        }
        if (Document.prototype.replaceChildren) {
          const origDocReplaceChildren = Document.prototype.replaceChildren;
          Document.prototype.replaceChildren = function(){
            try{ pushRecord({ ts: Date.now(), op: 'document.replaceChildren_blocked' }); console.warn('[GUARD] prevented document.replaceChildren'); }catch(e){}
            return; 
          };
        }
      } catch(e){}
        return origReplace.apply(this, arguments);
      };
    } catch(e){}

    // Also guard against setting innerHTML on documentElement or body by replacing property descriptors
    try {
      const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      if (desc && desc.set) {
        const origSet = desc.set;
        Object.defineProperty(Element.prototype, 'innerHTML', {
          configurable: true,
          enumerable: false,
          get: desc.get,
          set: function(v){
            try{
              const name = this && this.nodeName;
              if (name === 'HTML' || name === 'BODY' || this === document.documentElement || this === document.body) {
                pushRecord({ ts: Date.now(), op: 'innerHTML_blocked', target: name, len: (v && v.length) || 0 });
                console.warn('[GUARD] prevented setting innerHTML on root element:', name);
                return;
              }
            } catch(e){}
            return origSet.call(this, v);
          }
        });
      }
    } catch(e){}

    // Small heartbeat log so we know guard is active
    try { console.log('[GUARD] root-guard active'); pushRecord({ ts: Date.now(), op: 'guard_active' }); } catch(e){}
  } catch(e) { /* swallow */ }
})();
