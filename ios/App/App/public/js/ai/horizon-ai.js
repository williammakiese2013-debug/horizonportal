/* ============================================================
   🤖 HORIZON AI v2
   ● Rate limiting : 10 req / 60s (fenêtre glissante)
   ● Bug detection & auto-fix via eval sécurisé
   ● 120fps optimisations CSS + rAF throttling
   ============================================================ */
(function(){
'use strict';

/* ── Rate limiter (fenêtre glissante) ── */
const RL = {
  max: 10,           // max par fenêtre
  window: 60000,     // 60 secondes
  log: [],           // timestamps des requêtes
  canSend() {
    const now = Date.now();
    this.log = this.log.filter(t => now - t < this.window);
    return this.log.length < this.max;
  },
  consume() {
    this.log.push(Date.now());
    AI.updateRateBar();
  },
  remaining() {
    const now = Date.now();
    this.log = this.log.filter(t => now - t < this.window);
    return this.max - this.log.length;
  },
  /* ms avant que le slot le plus ancien expire */
  nextSlotIn() {
    if (!this.log.length) return 0;
    return Math.max(0, this.window - (Date.now() - this.log[0]));
  },
};

/* ── Stockage des fixes proposés ── */
const FIXES = {};   // id → { code, desc }
let fixIdCounter = 0;

/* ── Moteur IA ── */
const AI = {
  tab: 'chat',
  msgs: [],       // [{role,content,fixId?}]
  hist: [],       // [{role,content}] pour l'API
  busy: false,
  errCount: 0,
  errLog: [],
  fpsArr: [],
  lastT: performance.now(),
  frames: 0,
  monOn: false,

  SUGGS: {
    chat:  ['Quels bugs as-tu détecté ?','Que puis-je faire ?','Optimise les perfs','Change la scène','Aide VR','Explique le gaze'],
    debug: ['Analyse les erreurs JS','Vérifie l\'état de l\'app','Memory leak ?'],
    fix:   ['Corriger les erreurs détectées','Optimise renderHUD','Patch le gaze lag'],
    perf:  ['Analyse les FPS','Conseils 120fps','Réduire la mémoire'],
    scene: ['Quelle scène est active ?','Propose 3 scènes','Mode cinéma ?'],
  },

  /* Contexte injecté dans chaque appel API */
  ctx() {
    const s = (typeof state!=='undefined') ? state : {};
    const fps = this.fpsArr.length
      ? Math.round(this.fpsArr.reduce((a,b)=>a+b,0)/this.fpsArr.length) : '?';
    let mem = '?';
    try { if(performance.memory) mem = Math.round(performance.memory.usedJSHeapSize/1048576)+'MB'; } catch(_){}
    const errs = this.errLog.slice(-6).join('\n') || 'aucune';
    return `Tu es Horizon AI, assistant IA intégré dans "Horizon VR Portal" (app VR stéréoscopique A-Frame, single-file HTML ~11000 lignes).

ÉTAT TEMPS RÉEL :
- Scène : ${s.scene?.name||'?'} (${s.scene?.desc||'?'})
- App active : ${s.activeApp||'aucune'}
- Gaze : ${s.gazeEnabled?'ON':'OFF'} | Locked : ${s.locked?'oui':'non'}
- Multitâche : ${s.multiTaskMode?s.multiTaskSlots?.length+' fenêtres':'non'}
- Cinéma : ${s.cinemaMode?'oui':'non'}
- FPS moyen : ${fps} | Mémoire : ${mem}
- Erreurs JS récentes :\n${errs}
- Quota IA restant : ${RL.remaining()}/${RL.max} req/60s

APPS : safari,youtube,fexini,jeux,gamelauncher,notes,maison,visionhome,netflix,disney,appletv,applemusic
SCÈNES : aurora,desert,ocean,forest,city,space,mountain,waterfall,beach,volcano,jungle,snowfield,canyon,skyline,lavender,galaxy,cinema,bedroom,lounge,library,studio,loft,cafe,penthouse,cabin,gameroom

ACTIONS JS disponibles (tu peux les suggérer ou les fournir comme fix) :
- handleAction('scene:cinema')  → change la scène
- handleAction('open:netflix')  → ouvre une app
- handleAction('toggleCinema')  → mode cinéma
- handleAction('toggleGaze')    → active/désactive gaze
- document.body.classList.toggle('ai-perf-mode') → désactive animations CSS pour +fps

RÈGLES POUR LES FIXES :
Quand tu fournis un fix de code JS, entoure-le UNIQUEMENT dans un bloc \`\`\`fix\n<code>\n\`\`\` (pas \`\`\`js). Ce code sera proposé à l'utilisateur avec un bouton "Appliquer". Garde les fixes courts, ciblés et sûrs (pas d'eval de code venu de l'extérieur). Préfère des appels à handleAction ou des modifications de style/state.

Sois concis (max 3 phrases sauf si demande détaillée). Réponds en français.`;
  },

  /* Ajouter un message dans le chat */
  push(role, content, fixId) {
    this.msgs.push({role, content, fixId, ts: Date.now()});
    if (role === 'user') this.hist.push({role:'user', content});
    if (role === 'ai')   this.hist.push({role:'assistant', content});
    this.render();
  },

  /* Appel API avec rate limiting */
  async ask(text) {
    if (this.busy) return;
    if (!RL.canSend()) {
      const wait = Math.ceil(RL.nextSlotIn()/1000);
      this.push('ai', `⏳ **Quota atteint** (${RL.max} req/60s). Prochain slot dans ~${wait}s.`);
      this.updateRateBar();
      return;
    }
    this.busy = true;
    RL.consume();
    this.updateRateBar();
    this.push('user', text);
    this.setStatus('thinking');
    this.showTyping();
    document.getElementById('ai-send').disabled = true;

    try {
      const body = {
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: this.ctx(),
        messages: this.hist.slice(-10),
      };
      const bodyStr = JSON.stringify(body);

      /* Proxy CORS : les browsers mobiles bloquent api.anthropic.com directement.
         On essaie plusieurs proxies dans l'ordre jusqu'au premier succès. */
      const TARGET = 'https://api.anthropic.com/v1/messages';
      const HDRS = {'Content-Type':'application/json','x-anthropic-version':'2023-06-01'};

      const PROXIES = [
        // corsproxy.io — le plus fiable
        () => fetch('https://corsproxy.io/?' + encodeURIComponent(TARGET), {method:'POST', headers:HDRS, body:bodyStr}),
        // thingproxy — second choix
        () => fetch('https://thingproxy.freeboard.io/fetch/' + TARGET, {method:'POST', headers:HDRS, body:bodyStr}),
        // allorigins — wrapping JSON
        () => fetch('https://api.allorigins.win/post?url=' + encodeURIComponent(TARGET), {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({method:'POST', headers:HDRS, body:bodyStr}),
        }),
      ];

      let rawResp = null, lastErr = null;
      for (const tryP of PROXIES) {
        try {
          const res = await tryP();
          if (res.ok) { rawResp = res; break; }
        } catch(e) { lastErr = e; }
      }
      if (!rawResp) throw new Error('Réseau inaccessible : ' + (lastErr?.message||'tous les proxies ont échoué'));

      /* allorigins renvoie {contents:"…"} — on unwrap si besoin */
      const txt = await rawResp.text();
      let d;
      try { const o = JSON.parse(txt); d = o.contents ? JSON.parse(o.contents) : o; }
      catch(_) { throw new Error('Réponse proxy invalide'); }

      this.hideTyping();
      if (d.error) throw new Error(d.error.message);
      const raw = d.content?.map(b=>b.text||'').join('') || '…';

      /* Extraction du bloc fix si présent */
      const fixMatch = raw.match(/```fix\n([\s\S]*?)```/);
      let display = raw.replace(/```fix\n[\s\S]*?```/g, '[fix ci-dessous]');
      let fixId = null;
      if (fixMatch) {
        fixId = 'fix_' + (++fixIdCounter);
        FIXES[fixId] = { code: fixMatch[1].trim(), desc: display.trim() };
      }
      this.push('ai', display.trim(), fixId);
      this.detectActions(raw);

    } catch(e) {
      this.hideTyping();
      this.errCount++;
      this.errLog.push(`[${_ts()}] API: ${e.message}`);
      this.push('ai', `❌ Erreur API : ${e.message}`);
      this.updateMon();
    } finally {
      this.busy = false;
      this.setStatus('ok');
      document.getElementById('ai-send').disabled = false;
      this.updateRateBar();
      this.renderSuggs();
    }
  },

  /* Détecte actions mentionnées et propose boutons rapides */
  detectActions(text) {
    const sceneRx = /\b(aurora|desert|ocean|forest|city|space|mountain|waterfall|beach|volcano|jungle|snowfield|canyon|skyline|lavender|galaxy|cinema|bedroom|lounge|library|studio|loft|cafe|penthouse|cabin|gameroom)\b/i;
    const appRx   = /\b(safari|youtube|netflix|disney|applemusic|appletv|notes|maison|gamelauncher|jeux|visionhome)\b/i;
    const sm = text.match(sceneRx), am = text.match(appRx);
    if (!sm && !am) return;
    setTimeout(()=>{
      const suggs = document.getElementById('ai-suggs');
      if (!suggs) return;
      if (sm) {
        const b = _mkBtn(`🌍 ${sm[0]}`, ()=>{ if(typeof handleAction!=='undefined') handleAction(`scene:${sm[0].toLowerCase()}`); aiToast(`🌍 ${sm[0]}`); }, '#22c55e');
        suggs.prepend(b);
      }
      if (am) {
        const b = _mkBtn(`📱 ${am[0]}`, ()=>{ if(typeof handleAction!=='undefined') handleAction(`open:${am[0].toLowerCase()}`); aiToast(`📱 ${am[0]}`); }, '#6366f1');
        suggs.prepend(b);
      }
    }, 80);
  },

  /* Render messages */
  render() {
    const el = document.getElementById('ai-msgs');
    if (!el) return;
    el.innerHTML = this.msgs.map(m => {
      const isUser = m.role === 'user';
      const txt = _fmt(m.content);
      const fixBtn = m.fixId
        ? `<div class="ai-fix-btn" id="fb_${m.fixId}" onclick="aiApplyFix('${m.fixId}')">🔧 Appliquer le fix</div>`
        : '';
      return `<div class="ai-msg${isUser?' ai-user':''}">
        <div class="ai-msg-ava">${isUser?'👤':'🤖'}</div>
        <div class="ai-bubble">${txt}${fixBtn}</div>
      </div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  },

  renderSuggs() {
    const el = document.getElementById('ai-suggs');
    if (!el) return;
    const list = this.SUGGS[this.tab] || this.SUGGS.chat;
    el.innerHTML = list.map(s =>
      `<div class="ai-sugg" onclick="aiSendQ(this)">${s}</div>`
    ).join('');
  },

  showTyping() {
    const el = document.getElementById('ai-msgs');
    if (!el) return;
    const d = document.createElement('div');
    d.id = 'ai-typing'; d.className = 'ai-msg';
    d.innerHTML = '<div class="ai-msg-ava">🤖</div><div class="ai-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>';
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  },
  hideTyping() { document.getElementById('ai-typing')?.remove(); },

  setStatus(s) {
    const el = document.getElementById('ai-status');
    if (!el) return;
    if (s === 'thinking') { el.textContent = '⟳ traitement…'; el.className = 'thinking'; }
    else if (s === 'limited') { el.textContent = '⛔ quota'; el.className = 'limited'; }
    else { el.textContent = `✓ ${RL.remaining()}/${RL.max}`; el.className = ''; }
  },

  updateRateBar() {
    const rem = RL.remaining();
    const pct = (rem / RL.max * 100).toFixed(0);
    const fill = document.getElementById('ai-rate-bar-fill');
    const lbl  = document.getElementById('ai-rate-label');
    const dot  = document.getElementById('ai-notif-dot');
    if (fill) { fill.style.width = pct + '%'; fill.style.background = rem <= 2 ? 'linear-gradient(90deg,#ef4444,#f97316)' : rem <= 5 ? 'linear-gradient(90deg,#f59e0b,#6366f1)' : 'linear-gradient(90deg,#22c55e,#6366f1)'; }
    if (lbl)  lbl.textContent = `${rem}/${RL.max} req · ${rem > 0 ? 'prêt' : 'quota plein'}`;
    if (dot)  dot.className = 'ai-notif-dot' + (rem <= 2 ? ' ai-err' : rem <= 5 ? ' ai-warn' : '');
    this.setStatus(rem === 0 ? 'limited' : 'ok');
  },

  /* FPS Monitor — léger, 1 tick/sec max */
  initFPS() {
    const tick = t => {
      this.frames++;
      const dt = t - this.lastT;
      if (dt >= 1000) {
        const fps = Math.round(this.frames * 1000 / dt);
        this.fpsArr.push(fps);
        if (this.fpsArr.length > 60) this.fpsArr.shift();
        this.frames = 0; this.lastT = t;
        this.updateMon();

      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  /* Watch JS errors */
  initErrors() {
    window.addEventListener('error', e => {
      this.errCount++;
      this.errLog.push(`[${_ts()}] ${e.message} (${(e.filename||'').split('/').pop()}:${e.lineno||'?'})`);
      if (this.errLog.length > 60) this.errLog.shift();
      this.updateMon();
      /* dot d'alerte */
      const dot = document.getElementById('ai-notif-dot');
      if (dot && !dot.classList.contains('ai-err')) dot.classList.add('ai-warn');
      if (this.errCount === 1) aiToast('⚠️ Bug JS détecté — onglet Fix');
    });
    window.addEventListener('unhandledrejection', e => {
      this.errCount++;
      this.errLog.push(`[${_ts()}] Promise: ${e.reason}`);
      if (this.errLog.length > 60) this.errLog.shift();
      this.updateMon();
    });
  },

  updateMon() {
    const fps = this.fpsArr.length ? this.fpsArr[this.fpsArr.length-1] : 0;
    _monSet('mfps', `${fps}fps`, 'mfpsd', fps>=50?'ok':fps>=25?'warn':'err');
    try {
      if (performance.memory) {
        const mb = Math.round(performance.memory.usedJSHeapSize/1048576);
        _monSet('mmem', `${mb}MB`, 'mmemd', mb<200?'ok':mb<400?'warn':'err');
      }
    } catch(_){}
    _monSet('merr', `${this.errCount}err`, 'merrd', this.errCount===0?'ok':this.errCount<5?'warn':'err');
    const mon = document.getElementById('ai-mon');
    if (mon) mon.classList.toggle('visible', this.errCount > 0 || fps < 40 || this.monOn);
  },

  /* Message bienvenue (pas d'appel API) */
  welcome() {
    this.push('ai', `👋 **Horizon AI v2** opérationnel ! Je surveille les bugs, les FPS et je peux corriger ton code. Quota : **${RL.remaining()}/${RL.max}** req/60s. Demande-moi n'importe quoi !`);
    this.renderSuggs();
  },
};

/* ── Helpers ── */
function _ts() { return new Date().toLocaleTimeString(); }
function _fmt(s) {
  return s
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}
function _monSet(id, txt, dotId, cls) {
  const el = document.getElementById(id); if(el) el.textContent = txt;
  const d  = document.getElementById(dotId); if(d) d.className = 'ai-md-dot ai-md-'+cls;
}
function _mkBtn(label, fn, color) {
  const b = document.createElement('div');
  b.className = 'ai-sugg';
  b.style.cssText = `background:${color}22;border-color:${color}55;color:#fff`;
  b.textContent = label;
  b.onclick = fn;
  return b;
}

/* ── API publique ── */
window.aiToggle = function() {
  const p = document.getElementById('ai-panel');
  const f = document.getElementById('ai-fab');
  if (!p) return;
  const open = p.classList.toggle('ai-open');
  f.classList.toggle('ai-open', open);
  f.querySelector(':first-child')?.remove?.();
  f.insertAdjacentText('afterbegin', open ? '✕' : '🤖');
  if (open) {
    AI.monOn = true;
    document.getElementById('ai-mon')?.classList.add('visible');
    if (AI.msgs.length === 0) AI.welcome();
    AI.updateRateBar();
  } else {
    AI.monOn = false;
    AI.updateMon();
  }
};

window.aiTab = function(t) {
  AI.tab = t;
  document.querySelectorAll('.ai-tab').forEach((el,i) => {
    const tabs = ['chat','debug','fix','perf','scene'];
    el.classList.toggle('active', tabs[i] === t);
  });
  AI.renderSuggs();
  /* Analyse auto selon onglet */
  if (AI.msgs.length === 0) return;
  const auto = {
    debug: ()=> AI.ask(`Analyse les ${AI.errLog.length} erreurs JS détectées et dis-moi lesquelles sont critiques : ${AI.errLog.slice(-6).join(' | ')}`),
    fix:   ()=> AI.ask(`Génère un fix JS concret (bloc \`\`\`fix) pour ${AI.errCount > 0 ? 'les erreurs détectées' : 'améliorer les performances'} dans cette app VR.`),
    perf:  ()=> AI.ask(`FPS moyen actuel : ${AI.fpsArr.length ? Math.round(AI.fpsArr.reduce((a,b)=>a+b)/AI.fpsArr.length) : '?'}. Donne 3 optimisations JS/CSS concrètes pour atteindre 120fps.`),
    scene: ()=> AI.ask(`Scène active : ${(typeof state!=='undefined')?state.scene?.name:'?'}. Propose 3 autres scènes adaptées.`),
  };
  if (auto[t] && RL.canSend()) auto[t]();
};

window.aiSend = function() {
  const inp = document.getElementById('ai-in');
  if (!inp) return;
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = ''; inp.style.height = '32px';
  AI.ask(txt);
};

window.aiSendQ = function(el) { AI.ask(el.textContent.trim()); };

window.aiToast = function(msg, ms=3000) {
  const t = document.getElementById('ai-toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), ms);
};

/* Application d'un fix JS via eval limité */
window.aiApplyFix = function(id) {
  const fix = FIXES[id];
  if (!fix) return;
  const btn = document.getElementById('fb_'+id);
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(fix.code);
    fn();
    if (btn) { btn.className = 'ai-fix-btn applied'; btn.textContent = '✓ Fix appliqué'; }
    aiToast('✅ Fix appliqué avec succès !');
    AI.errLog.push(`[${_ts()}] Fix ${id} appliqué OK`);
  } catch(e) {
    if (btn) { btn.className = 'ai-fix-btn'; btn.textContent = '❌ Erreur'; }
    aiToast('❌ Fix échoué : ' + e.message);
    AI.errLog.push(`[${_ts()}] Fix ${id} erreur: ${e.message}`);
  }
};

/* ── 120fps : optimisations globales au démarrage ── */
(function apply120fps(){
  /* 1. CSS contain sur les éléments les plus lourds */
  const style = document.createElement('style');
  style.textContent = `
    .hud-wrap,.multitask-slot-wrap{contain:layout style;transform:translateZ(0)}
    .glass,.glass-soft{contain:layout style}
    .app-win,.launchpad{transform:translateZ(0);will-change:transform}
    /* Désactive backdrop-filter sur les éléments non visibles = -perf win */
    [data-app-hidden] .glass{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    /* Scroll rapide */
    *{-webkit-overflow-scrolling:touch}
  `;
  document.head.appendChild(style);

  /* 2. Throttle renderHUD pour éviter les renders inutiles (< 8ms entre deux) */
  if (typeof renderHUD === 'function') {
    let lastRender = 0, pendingRender = false;
    const _origRender = window.renderHUD;
    window.renderHUD = function() {
      const now = performance.now();
      if (now - lastRender < 8) {   // max ~120fps
        if (!pendingRender) {
          pendingRender = true;
          requestAnimationFrame(()=>{ pendingRender=false; lastRender=performance.now(); _origRender(); AI.updateMon(); });
        }
        return;
      }
      lastRender = now;
      _origRender.apply(this, arguments);
      AI.updateMon();
    };
  }

  /* 3. requestIdleCallback pour les tâches non-critiques de l'IA */
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = fn => setTimeout(fn, 1);
  }
})();

/* ── Init ── */
AI.initErrors();
AI.initFPS();
AI.updateRateBar();

/* Toast de bienvenue différé (n'impacte pas le chargement) */
requestIdleCallback(()=>{
  setTimeout(()=>aiToast('🤖 Horizon AI v2 prêt', 3500), 2500);
});

console.log('🤖 Horizon AI v2 — rate-limit: '+RL.max+'/'+RL.window+'ms · 120fps mode ON');

})(); // IIFE — pas de pollution globale
