/* ============================================================
   RÉGLAGES
   ============================================================ */
function buildSettingsHTML(){
  const sec = state.settingsSection || 'lockscreen';
  const menuItems = [
    { id:'lockscreen', ico:'🔒', bg:'#636366', label:'Écran de verrouillage' },
    { id:'display',    ico:'💡', bg:'#2c2c2e', label:'Affichage & luminosité' },
    { id:'vr',         ico:'🕶️', bg:'#5856d6', label:'Calibration VR' },
    { id:'wifi',       ico:'📶', bg:'#0a84ff', label:'Wi-Fi' },
    { id:'bluetooth',  ico:'🔵', bg:'#0a84ff', label:'Bluetooth' },
    { id:'son',        ico:'🔔', bg:'#ff3b30', label:'Sons & haptiques' },
    { id:'general',    ico:'⚙️', bg:'#636366', label:'Général' },
    { id:'accessib',   ico:'♿', bg:'#0a84ff', label:'Accessibilité' },
  ];

  let panelHTML = '';

  if(sec === 'lockscreen'){
    const codeStr = state.lockscreenPasscode ? '••••••' : 'Non défini';
    // Si on est en train de changer le code
    if(state.lockscreenChangingCode){
      const step = state.lockscreenCodeStep;
      const title = step === 0 ? 'Nouveau code (6 chiffres)' : 'Confirmer le nouveau code';
      const currentInput = step === 0 ? state.lockscreenNewCode : state.lockscreenInput;
      const dots = Array.from({length:6},(_,i) =>
        `<div class="settings-code-dot ${i < currentInput.length ? 'filled' : ''}"></div>`
      ).join('');
      panelHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Changer le code</div>
        <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:8px;cursor:default">
          <div style="font-size:12px;font-weight:600">${title}</div>
          <div class="settings-code-input">${dots}</div>
          <div style="font-size:10px;color:#ff6b6b;min-height:14px" id="settings-code-err"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;max-width:240px">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => k==='' ? '<div></div>' :
            `<div class="ls-num-btn" style="width:56px;height:56px;font-size:20px;background:rgba(255,255,255,.1);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer"
              data-gaze data-action="settings:code:${k}">${k}</div>`
          ).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <div class="settings-row" style="flex:1;justify-content:center" data-gaze data-action="settings:code:cancel">
            <span style="color:#ff6b6b;font-size:12px">Annuler</span>
          </div>
        </div>
      </div>`;
    } else {
      panelHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Écran de verrouillage</div>
        <div class="settings-row" data-gaze data-action="settings:lockscreen:wallpaper">
          <div class="settings-row-left">
            <span class="settings-row-ico">🖼</span>
            <div>
              <div class="settings-row-label">Changer le fond d'écran</div>
              <div class="settings-row-sub">Choisir une image de verrouillage</div>
            </div>
          </div>
          <div class="settings-row-right">
            <span style="font-size:9px">${state.lockscreenWallpaper ? 'Personnalisé' : 'Défaut'}</span>
            <span class="settings-chevron">›</span>
          </div>
        </div>
        <div class="settings-row" data-gaze data-action="settings:lockscreen:changecode">
          <div class="settings-row-left">
            <span class="settings-row-ico">🔑</span>
            <div>
              <div class="settings-row-label">Changer le code</div>
              <div class="settings-row-sub">Code actuel : ${codeStr}</div>
            </div>
          </div>
          <div class="settings-row-right"><span class="settings-chevron">›</span></div>
        </div>
        <div class="settings-row" data-gaze data-action="settings:lockscreen:activate">
          <div class="settings-row-left">
            <span class="settings-row-ico">🔒</span>
            <div>
              <div class="settings-row-label">Verrouiller maintenant</div>
              <div class="settings-row-sub">Active l'écran de verrouillage</div>
            </div>
          </div>
          <div class="settings-row-right"><span class="settings-chevron">›</span></div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Notifications</div>
        <div class="settings-row">
          <div class="settings-row-left">
            <span class="settings-row-ico">🌙</span>
            <div><div class="settings-row-label">Ne pas déranger</div></div>
          </div>
          <div class="settings-toggle ${state.dndEnabled?'on':''}" data-gaze data-action="settings:toggle:dnd"></div>
        </div>
      </div>`;
    }
  } else if(sec === 'vr'){
    panelHTML = `
    <div class="settings-section">
      <div class="settings-section-title">Recalibrage de l'affichage</div>
      <div class="settings-row" data-gaze data-action="settings:vr:opencalib">
        <div class="settings-row-left">
          <span class="settings-row-ico">🎛️</span>
          <div>
            <div class="settings-row-label">Recalibrer les lentilles</div>
            <div class="settings-row-sub">Écartement, taille, arrondi, distance d'écran…</div>
          </div>
        </div>
        <div class="settings-row-right"><span class="settings-chevron">›</span></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Position de l'interface</div>
      <div class="settings-row" data-gaze data-action="settings:vr:recenter">
        <div class="settings-row-left">
          <span class="settings-row-ico">⊙</span>
          <div>
            <div class="settings-row-label">Recentrer l'interface</div>
            <div class="settings-row-sub">Regardez l'endroit voulu pendant 4 secondes</div>
          </div>
        </div>
        <div class="settings-row-right"><span class="settings-chevron">›</span></div>
      </div>
      <div class="settings-row" style="flex-wrap:wrap;gap:6px">
        <div class="settings-row-left" style="flex:1;min-width:140px">
          <span class="settings-row-ico">↕</span>
          <div>
            <div class="settings-row-label">Distance de l'interface</div>
            <div class="settings-row-sub" id="settingsDepthVal">${(state.uiDepthExtra>=0?'+':'')+state.uiDepthExtra}px</div>
          </div>
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          <div class="settings-depth-btn" data-gaze data-action="depthStep:-50" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:700">−</div>
          <input type="range" id="settingsRngDepth" min="-200" max="400" step="10" value="${state.uiDepthExtra||0}" style="width:100px;height:4px;accent-color:#c6ff3d">
          <div class="settings-depth-btn" data-gaze data-action="depthStep:50" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:700">+</div>
        </div>
      </div>
    </div>`;
  } else if(sec === 'display'){
    panelHTML = `
    <div class="settings-section">
      <div class="settings-section-title">Affichage</div>
      <div class="settings-row">
        <div class="settings-row-left"><span class="settings-row-ico">☀️</span><div><div class="settings-row-label">Luminosité</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">80%</span></div>
      </div>
      <div class="settings-row">
        <div class="settings-row-left"><span class="settings-row-ico">🌑</span><div><div class="settings-row-label">Mode sombre</div></div></div>
        <div class="settings-toggle on"></div>
      </div>
    </div>`;
  } else if(sec === 'general'){
    const gpu = state.deviceGPU || 'Détection en cours…';
    const gpuVendor = state.deviceGPUVendor || '';
    const webglVer = state.deviceWebGLVersion || '—';
    const cores = navigator.hardwareConcurrency || '—';
    const ram = navigator.deviceMemory ? (navigator.deviceMemory + ' Go') : 'Non communiquée';
    const platform = navigator.platform || navigator.userAgentData?.platform || 'Inconnue';
    const isMobileUA = /Android|iPhone|iPad|iPod|Quest|Oculus/i.test(navigator.userAgent);
    const modele = /Quest|Oculus/i.test(navigator.userAgent) ? 'Casque VR autonome' : (isMobileUA ? 'Appareil mobile' : 'Ordinateur');
    let storageInfo = null;
    if(!state.storageEstimateFetched){
      state.storageEstimateFetched = true;
      if(navigator.storage && navigator.storage.estimate){
        navigator.storage.estimate().then(est => {
          state.storageEstimate = est;
          renderHUD();
        }).catch(()=>{});
      }
    }
    if(state.storageEstimate){
      const used = state.storageEstimate.usage || 0;
      const quota = state.storageEstimate.quota || 0;
      const fmt = n => n > 1073741824 ? (n/1073741824).toFixed(1)+' Go' : (n/1048576).toFixed(0)+' Mo';
      storageInfo = quota ? `${fmt(used)} utilisés sur ${fmt(quota)}` : fmt(used)+' utilisés';
    }
    panelHTML = `
    <div class="settings-section">
      <div class="settings-section-title">À propos</div>
      <div class="settings-row" style="cursor:default">
        <div class="settings-row-left"><span class="settings-row-ico">🖥️</span><div><div class="settings-row-label">Type d'appareil</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">${modele}</span></div>
      </div>
      <div class="settings-row" style="cursor:default">
        <div class="settings-row-left"><span class="settings-row-ico">💻</span><div><div class="settings-row-label">Plateforme</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">${platform}</span></div>
      </div>
      <div class="settings-row" style="cursor:default">
        <div class="settings-row-left"><span class="settings-row-ico">💾</span><div><div class="settings-row-label">Stockage</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">${storageInfo || 'Calcul en cours…'}</span></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Matériel graphique</div>
      <div class="settings-row" style="cursor:default;flex-direction:column;align-items:flex-start;gap:2px">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <span class="settings-row-ico">🎮</span>
          <div style="flex:1;min-width:0">
            <div class="settings-row-label">Carte graphique</div>
            <div class="settings-row-sub" style="white-space:normal;word-break:break-word">${gpu}</div>
          </div>
        </div>
      </div>
      ${gpuVendor ? `
      <div class="settings-row" style="cursor:default">
        <div class="settings-row-left"><span class="settings-row-ico">🏷️</span><div><div class="settings-row-label">Fabricant</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">${gpuVendor}</span></div>
      </div>` : ''}
      <div class="settings-row" style="cursor:default">
        <div class="settings-row-left"><span class="settings-row-ico">🧩</span><div><div class="settings-row-label">API graphique</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">${webglVer}</span></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Processeur & mémoire</div>
      <div class="settings-row" style="cursor:default">
        <div class="settings-row-left"><span class="settings-row-ico">⚡</span><div><div class="settings-row-label">Cœurs processeur</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">${cores}</span></div>
      </div>
      <div class="settings-row" style="cursor:default">
        <div class="settings-row-left"><span class="settings-row-ico">🧠</span><div><div class="settings-row-label">Mémoire (RAM)</div></div></div>
        <div class="settings-row-right"><span style="font-size:10px">${ram}</span></div>
      </div>
    </div>`;
  } else {
    panelHTML = `<div style="padding:20px;opacity:.5;font-size:12px">Section en cours de développement…</div>`;
  }

  return `<div class="settings-root">
    <div class="settings-topbar">
      <div class="settings-title">⚙️ Réglages</div>
      <div class="settings-back" data-gaze data-action="closeApp">✕ Fermer</div>
    </div>
    <div class="settings-body">
      <div class="settings-sidebar">
        ${menuItems.map(m => `
          <div class="settings-menu-item ${sec===m.id?'active':''}" data-gaze data-action="settings:nav:${m.id}">
            <div class="settings-menu-ico" style="background:${m.bg}">${m.ico}</div>
            <span>${m.label}</span>
          </div>`).join('')}
      </div>
      <div class="settings-panel">
        ${panelHTML}
      </div>
    </div>
  </div>`;
}

function buildGalleryHTML(){
  const userItems = state.userMedia;
  const exterieurs = SCENES.slice(0, 16);
  const interieurs = SCENES.slice(16);

  const renderSection = (title, items) => items.length === 0 ? '' : `
    <div style="font-size:11px;font-weight:600;opacity:.7;margin:10px 0 5px;letter-spacing:.5px">${title}</div>
    <div class="grid-4">${items.map(i => thumbHtml(i, true)).join('')}</div>
  `;

  return `
  <div style="position:relative">
    <div id="galleryScroll" class="dock glass" style="max-height:74vh;overflow-y:scroll;overflow-x:hidden;scroll-behavior:smooth;padding-right:6px">
      <div style="position:sticky;top:0;background:rgba(0,0,0,.45);backdrop-filter:blur(14px);z-index:10;border-radius:12px;padding:6px 10px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <div class="pill glass-soft" data-gaze data-action="panel:dock">← Retour</div>
        <div class="pill glass-soft">Galerie</div>
        <div class="pill glass-soft" data-gaze data-action="addFiles">＋ Importer</div>
      </div>
      ${userItems.length > 0 ? `
        <div style="font-size:11px;font-weight:600;opacity:.7;margin:4px 0 5px;letter-spacing:.5px">📁 Mes médias</div>
        <div class="grid-4">
          <div class="add-btn" data-gaze data-action="addFiles">＋ Ajouter<br>photo / vidéo</div>
          ${userItems.map(i => thumbHtml(i, true)).join('')}
        </div>
      ` : `
        <div class="add-btn" style="margin-bottom:10px" data-gaze data-action="addFiles">＋ Ajouter une photo / vidéo 360°</div>
      `}
      ${renderSection('🌿 Extérieurs & Nature', exterieurs)}
      ${renderSection('🏠 Intérieurs', interieurs)}
      <div style="height:20px"></div>
    </div>

    <!-- Slider gaze latéral -->
    <div class="gaze-scroll-bar">
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-up" title="Monter">▲</div>
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-up2" title="Monter vite" style="font-size:12px;opacity:.7">▲▲</div>
      <div style="width:2px;height:18px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto"></div>
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-down2" title="Descendre vite" style="font-size:12px;opacity:.7">▼▼</div>
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-down" title="Descendre">▼</div>
    </div>
  </div>`;
}

function buildImportChoiceHTML(){
  const name = state.importPendingMedia?.name || 'Média';
  return `
  <div class="dock glass" style="align-items:center;text-align:center">
    <div style="font-size:11px;opacity:.7;margin-bottom:4px">Fichier importé :</div>
    <div style="font-size:13px;font-weight:600;margin-bottom:14px">${name}</div>
    <div style="display:flex;gap:14px;width:100%">
      <div class="tile glass-soft" data-gaze data-action="import-as-screen" style="flex:1;align-items:center;padding:20px;cursor:pointer">
        <div style="font-size:28px;margin-bottom:8px">📺</div>
        <div class="tile-title">Mode Écran</div>
        <div class="tile-sub">Cinéma virtuel 16:9</div>
      </div>
      <div class="tile glass-soft" data-gaze data-action="import-as-sky" style="flex:1;align-items:center;padding:20px;cursor:pointer">
        <div style="font-size:28px;margin-bottom:8px">🌌</div>
        <div class="tile-title">Arrière-plan 360°</div>
        <div class="tile-sub">Décor immersif</div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div class="pill glass-soft" data-gaze data-action="panel:gallery" style="display:inline-block">← Annuler</div>
    </div>
  </div>`;
}

function buildRailHTML(){
  return `<div class="rail glass">
    <div class="btn glass-soft" data-gaze data-action="panel:dock">🏠<br>Home</div>
    <div class="btn glass-soft" data-gaze data-action="panel:gallery">🖼<br>Médias</div>
    <div class="btn glass-soft" data-gaze data-action="toggleLock">${state.locked?'🔒':'🔓'}<br>${state.locked?'Figé':'Libre'}</div>
    <div class="btn glass-soft" data-gaze data-action="toggleGaze">${state.gazeEnabled?'👁':'✋'}<br>Regard</div>
    <div class="btn glass-soft" data-gaze data-action="fullscreen">⛶<br>VR</div>
  </div>`;
}

/* ── Clavier virtuel universel ──
   state.vkbField    : identifiant du champ ('notes','browserUrl','name','story',…)
   state.vkbText     : texte en cours d'édition
   state.vkbCallback : function(text) appelée à chaque frappe
*/
function openVKB(field, currentText, callback){
  state.vkbField    = field;
  state.vkbText     = currentText || '';
  state.vkbCallback = callback;
  state.keyboardTarget = field;
  renderHUD();
}
function closeVKB(){
  state.vkbField    = null;
  state.vkbCallback = null;
  state.keyboardTarget = null;
  renderHUD();
}
function vkbType(k){
  if(!state.vkbField) return;
  // Son clavier rétro-futuriste à chaque frappe
  playKeySound();
  if(k === '⌫')         state.vkbText = state.vkbText.slice(0,-1);
  else if(k === '↵'){
    if(state.vkbField==='browserUrl'){
      let url = state.vkbText.trim();
      if(url){
        if(!url.includes('.') || url.includes(' ')){
          url = 'https://www.google.com/search?q=' + encodeURIComponent(url) + '&hl=fr';
        } else if(!url.startsWith('http')){
          url = 'https://' + url;
        }
        browserNavigate(url);
      }
      closeVKB(); return;
    }
    state.vkbText += '\n';
  }
  else if(k === 'space') state.vkbText += ' ';
  else                   state.vkbText += k.toLowerCase();
  if(state.vkbCallback) state.vkbCallback(state.vkbText);
  renderHUD();
}
function openNativeKB(currentText, onDone){
  const inp = document.getElementById('_nativeKbInput');
  if(!inp) return;
  inp.value = currentText || '';
  inp.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:1px;opacity:0;pointer-events:auto;z-index:99999;font-size:16px;border:none;outline:none;background:transparent;color:transparent;';
  inp._onDone = onDone;
  setTimeout(()=>inp.focus(),50);
}
function buildGenericKeyboardHTML(){
  const letters = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['A','Z','E','R','T','Y','U','I','O','P'],
    ['Q','S','D','F','G','H','J','K','L','M'],
    ["W","X","C","V","B","N","'","-","_","."],
  ];
  const isBrowserUrl = state.vkbField === 'browserUrl';
  const preview = state.vkbText || '';
  const _esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div class="app-dock glass" style="flex-wrap:wrap;padding:6px 8px;gap:4px;width:auto;max-width:95vw">
    <div style="width:100%;padding:5px 10px;border-radius:10px;background:rgba(255,255,255,0.1);
      font-size:11px;min-height:22px;word-break:break-all;letter-spacing:.3px;opacity:.9;display:flex;align-items:center;gap:6px">
      ${isBrowserUrl ? '<span style="opacity:.4;font-size:9px">🌐</span>' : ''}
      <span style="flex:1">${_esc(preview)}<span style="opacity:.5">▎</span></span>
      ${isBrowserUrl ? `<div class="kb-key" style="min-width:44px;height:24px;font-size:10px;background:rgba(80,200,120,0.3);border-color:rgba(80,200,120,0.6);flex-shrink:0"
        data-gaze data-action="vkb:↵">🌐 Go</div>` : ''}
    </div>
    ${isBrowserUrl ? `<div style="display:flex;gap:3px;width:100%;justify-content:center;flex-wrap:wrap">
      ${['https://','http://','www.','.com','.fr','.org','/','.net'].map(s=>
        `<div class="kb-key" style="min-width:auto;padding:0 8px;height:26px;font-size:9px;background:rgba(41,151,255,0.18);border-color:rgba(41,151,255,0.4)"
          data-gaze data-action="vkb:shortcut:${encodeURIComponent(s)}">${s}</div>`
      ).join('')}
    </div>` : ''}
    <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;width:100%">
      ${letters.map(row => row.map(k =>
        `<div class="kb-key" style="min-width:30px;height:30px;font-size:10px"
          data-gaze data-action="vkb:${k}">${k}</div>`
      ).join('')).join('')}
    </div>
    <div style="display:flex;gap:4px;width:100%;justify-content:center;margin-top:2px">
      <div class="kb-key kb-wide" style="min-width:70px;height:30px;font-size:10px"
        data-gaze data-action="vkb:space">␣ Espace</div>
      <div class="kb-key" style="min-width:38px;height:30px;font-size:12px"
        data-gaze data-action="vkb:⌫">⌫</div>
      <div class="kb-key" style="min-width:38px;height:30px;font-size:11px"
        data-gaze data-action="vkb:↵">${isBrowserUrl ? '🌐' : '↵'}</div>
      <div class="kb-key" style="min-width:44px;height:30px;font-size:9px;background:rgba(255,255,255,0.08)"
        data-gaze data-action="vkb:paste">📋 Coller</div>
      <div class="kb-key" style="min-width:44px;height:30px;font-size:9px;background:rgba(255,80,80,0.2)"
        data-gaze data-action="vkb:done">✕ Fermer</div>
    </div>
  </div>`;
}

/* ── Clavier universel dans la barre du bas (bouton ⌨️) ──
   Clavier flottant disponible depuis n'importe quelle app.
   L'utilisateur peut taper du texte en mode libre,
   puis le coller / l'envoyer selon l'app active.
*/
function buildDockKeyboardHTML(){
  const letters = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['A','Z','E','R','T','Y','U','I','O','P'],
    ['Q','S','D','F','G','H','J','K','L','M'],
    ["W","X","C","V","B","N","'","-","_","."],
  ];
  const text = state.dockKbText || '';
  const _esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const activeApp = state.activeApp;
  // Action contextuelle selon l'app active
  let actionLabel = '↵ Envoyer';
  let actionStyle = 'background:rgba(255,200,80,0.28);border-color:rgba(255,200,80,0.55)';
  if(activeApp === 'safari'){
    actionLabel = '🌐 Go';
    actionStyle = 'background:rgba(80,200,120,0.28);border-color:rgba(80,200,120,0.5)';
  } else if(activeApp === 'notes'){
    actionLabel = '📝 Insérer';
    actionStyle = 'background:rgba(100,180,255,0.22);border-color:rgba(100,180,255,0.45)';
  }

  return `<div class="app-dock glass" style="flex-direction:column;align-items:stretch;padding:5px 8px;gap:3px;max-width:920px;width:auto">
    <!-- Header avec champ texte + boutons -->
    <div style="display:flex;align-items:center;gap:5px">
      <!-- Bouton fermer -->
      <div style="padding:3px 9px;border-radius:8px;background:rgba(255,80,80,0.2);
        border:1px solid rgba(255,80,80,0.4);font-size:10px;cursor:pointer;white-space:nowrap;flex-shrink:0"
        data-gaze data-action="toggleDockKb">✕ Fermer</div>
      <!-- Champ de saisie -->
      <div style="flex:1;padding:4px 8px;border-radius:9px;background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.18);font-size:10px;min-height:22px;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:4px">
        <span style="opacity:.4;font-size:9px">⌨️</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis">
          ${_esc(text) || '<span style="opacity:.3">Saisissez du texte…</span>'}
          <span style="opacity:.45">▎</span>
        </span>
      </div>
      <!-- Action contextuelle -->
      <div style="padding:3px 9px;border-radius:8px;${actionStyle};font-size:9px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0"
        data-gaze data-action="dock-kb:action">${actionLabel}</div>
      <!-- Effacer -->
      <div style="padding:3px 8px;border-radius:8px;background:rgba(255,255,255,0.08);
        border:1px solid rgba(255,255,255,0.18);font-size:9px;cursor:pointer;flex-shrink:0"
        data-gaze data-action="dock-kb:clear">🗑</div>
    </div>

    <!-- Touches lettres -->
    <div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center">
      ${letters.map(row => row.map(k =>
        `<div class="kb-key" style="min-width:28px;height:26px;font-size:9px"
          data-gaze data-action="dock-kb:key:${k}">${k}</div>`
      ).join('')).join('')}
    </div>

    <!-- Ligne finale -->
    <div style="display:flex;gap:3px;width:100%;justify-content:center">
      <div class="kb-key kb-wide" style="min-width:65px;height:26px;font-size:9px"
        data-gaze data-action="dock-kb:key:space">␣ Espace</div>
      <div class="kb-key" style="min-width:34px;height:26px;font-size:11px"
        data-gaze data-action="dock-kb:key:⌫">⌫</div>
      <div class="kb-key" style="min-width:34px;height:26px;font-size:10px;${actionStyle}"
        data-gaze data-action="dock-kb:action">${activeApp==='safari'?'🌐':activeApp==='notes'?'📝':'↵'}</div>
      <div class="kb-key" style="min-width:42px;height:26px;font-size:8.5px;background:rgba(255,255,255,0.07)"
        data-gaze data-action="dock-kb:paste">📋</div>
    </div>
  </div>`;
}

/* ── Clavier Safari permanent dans la barre du bas ──
   Affiché en permanence quand l'app Safari est ouverte.
   Permet de taper une URL sans ouvrir un overlay séparé.
*/
function buildSafariBottomKeyboardHTML(){
  // Initialiser le texte courant si pas encore fait
  if(state.vkbField !== 'browserUrl' && !state.safariKbActive){
    // Clavier en mode "rapide" : on utilise vkbText pour l'URL
  }
  const letters = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['A','Z','E','R','T','Y','U','I','O','P'],
    ['Q','S','D','F','G','H','J','K','L','M'],
    ["W","X","C","V","B","N","'","-","_","."],
  ];
  const isBrowserUrl = true;
  const preview = state.safariKbText !== undefined ? state.safariKbText : (state.browserState?.currentUrl || '');
  const _esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  return `<div class="app-dock glass" style="flex-direction:column;align-items:stretch;padding:5px 8px;gap:3px;max-width:860px;width:auto">
    <!-- Barre URL de saisie -->
    <div style="display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:10px;
      background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.18);min-height:24px">
      <span style="opacity:.45;font-size:10px">🌐</span>
      <span style="flex:1;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9">
        ${_esc(preview) || '<span style="opacity:.35">Tapez une URL ou recherchez…</span>'}
        <span style="opacity:.4">▎</span>
      </span>
      <div style="padding:2px 8px;border-radius:7px;background:rgba(80,200,120,0.28);
        border:1px solid rgba(80,200,120,0.5);font-size:9px;font-weight:700;cursor:pointer;white-space:nowrap"
        data-gaze data-action="safari-kb:go">🌐 Go</div>
      <div style="padding:2px 7px;border-radius:7px;background:rgba(255,80,80,0.2);
        border:1px solid rgba(255,80,80,0.4);font-size:9px;cursor:pointer"
        data-gaze data-action="safari-kb:clear">✕</div>
    </div>

    <!-- Raccourcis URL -->
    <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center">
      ${['https://','http://','www.','.com','.fr','.org','/','.net'].map(s=>
        `<div style="padding:2px 7px;border-radius:7px;background:rgba(41,151,255,0.15);
          border:1px solid rgba(41,151,255,0.35);font-size:8.5px;cursor:pointer;white-space:nowrap"
          data-gaze data-action="safari-kb:shortcut:${encodeURIComponent(s)}">${s}</div>`
      ).join('')}
    </div>

    <!-- Touches lettres -->
    <div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center">
      ${letters.map(row => row.map(k =>
        `<div class="kb-key" style="min-width:28px;height:26px;font-size:9px"
          data-gaze data-action="safari-kb:key:${k}">${k}</div>`
      ).join('')).join('')}
    </div>

    <!-- Ligne finale -->
    <div style="display:flex;gap:3px;width:100%;justify-content:center">
      <div class="kb-key kb-wide" style="min-width:65px;height:26px;font-size:9px"
        data-gaze data-action="safari-kb:key:space">␣ Espace</div>
      <div class="kb-key" style="min-width:34px;height:26px;font-size:11px"
        data-gaze data-action="safari-kb:key:⌫">⌫</div>
      <div class="kb-key" style="min-width:34px;height:26px;font-size:10px;background:rgba(80,200,120,0.2);border-color:rgba(80,200,120,0.5)"
        data-gaze data-action="safari-kb:go">🌐</div>
      <div class="kb-key" style="min-width:42px;height:26px;font-size:8.5px;background:rgba(255,255,255,0.07)"
        data-gaze data-action="safari-kb:paste">📋 Coller</div>
    </div>
  </div>`;
}

function buildAppDockHTML(){
  if(state.vkbField || state.keyboardTarget){
    return buildGenericKeyboardHTML();
  }
  // Clavier Safari permanent dans la barre du bas quand Safari est ouvert
  if(state.activeApp === 'safari'){
    return buildSafariBottomKeyboardHTML();
  }
  // Clavier universel ouvert via le bouton ⌨️
  if(state.dockKbOpen){
    return buildDockKeyboardHTML();
  }
  const mtActive = state.multiTaskMode;
  return `<div class="app-dock glass">
    ${APPS.map(a => {
      const iconSrc = state.dockIcons && state.dockIcons[a.id];
      return `
      <div class="app-icon glass-soft" data-gaze data-action="app:${a.id}">
        ${iconSrc ? `<img src="${iconSrc}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block">` : a.customIcon ? `<img src="${a.customIcon}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block">` : `<div class="ico">${a.icon}</div>`}
        <div>${a.name}</div>
      </div>`;
    }).join('')}
    <div class="app-icon glass-soft" data-gaze data-action="openLaunchpad">
      ${(state.dockIcons&&state.dockIcons.launchpad)?`<img src="${state.dockIcons.launchpad}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block">`:'<div class="ico">▦</div>'}
      <div>Launchpad</div>
    </div>
    <div class="app-icon glass-soft${mtActive?' multitask-toggle active':''}" data-gaze data-action="toggleMultitask"
      style="${mtActive?'border-color:rgba(41,151,255,0.6);background:rgba(41,151,255,0.22)':''}">
      ${(state.dockIcons&&state.dockIcons.multitask)?`<img src="${state.dockIcons.multitask}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block">`:'<div class="ico">⊞</div>'}
      <div>Multi-tâche</div>
    </div>
    <div class="app-icon glass-soft" data-gaze data-action="toggleDockKb"
      style="border-color:rgba(255,200,80,0.4);background:rgba(255,200,80,0.10)">
      ${(state.dockIcons&&state.dockIcons.clavier)?`<img src="${state.dockIcons.clavier}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block">`:'<div class="ico">⌨️</div>'}
      <div>Clavier</div>
    </div>
  </div>`;
}

function buildMultitaskPickerHTML(){
  const slots = state.multiTaskSlots;
  const slotsHTML = slots.map((s,i) => {
    const app = APPS.find(a=>a.id===s.appId)||{icon:'?',name:s.appId};
    return `<div class="multitask-slot-item">
      <div class="multitask-slot-ico">${app.icon}</div>
      <div class="multitask-slot-name">${app.name}</div>
      <div class="multitask-slot-close" data-gaze data-action="multitask:close:${i}">✕</div>
    </div>`;
  }).join('');
  const canAdd = slots.length < 5;
  const addAppsHTML = canAdd ? `
    <div style="font-size:10px;opacity:.6;margin:6px 0 3px">Ajouter une app (${slots.length}/5) :</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">
      ${APPS.filter(a=>!slots.find(s=>s.appId===a.id)).map(a=>
        `<div class="multitask-slot-item" style="padding:5px 8px;flex:0 0 auto" data-gaze data-action="multitask:add:${a.id}">
          <div class="multitask-slot-ico" style="font-size:14px;width:22px">${a.icon}</div>
          <div class="multitask-slot-name" style="font-size:10px">${a.name}</div>
        </div>`
      ).join('')}
    </div>
  ` : `<div style="font-size:10px;opacity:.5;text-align:center;padding:6px">Maximum 5 fenêtres atteint</div>`;
  const distPct = Math.round((state.multiTaskDistanceScale||1)*100);
  const distanceControlHTML = `
    <div class="settings-row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
      <div class="settings-row-left" style="flex:1;min-width:140px">
        <span class="settings-row-ico">↔</span>
        <div>
          <div class="settings-row-label">Distance des fenêtres</div>
          <div class="settings-row-sub" id="mtDistVal">${distPct}%</div>
        </div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <div class="settings-depth-btn" data-gaze data-action="multitaskDist:-10" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:700">−</div>
        <input type="range" id="mtRngDistance" min="55" max="145" step="5" value="${distPct}" style="width:100px;height:4px;accent-color:#c6ff3d">
        <div class="settings-depth-btn" data-gaze data-action="multitaskDist:10" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:700">+</div>
      </div>
    </div>`;
  return `<div class="multitask-picker glass">
    <div class="multitask-picker-title">⊞ Multitâche — Fenêtres ouvertes</div>
    <div class="multitask-slot-list">${slotsHTML}</div>
    ${addAppsHTML}
    ${distanceControlHTML}
    <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
      <div class="pill glass-soft" data-gaze data-action="multitask:closeAll" style="font-size:10px;padding:5px 10px">Tout fermer</div>
      <div class="pill glass-soft" data-gaze data-action="closeMultitaskPicker" style="font-size:10px;padding:5px 10px">← Retour</div>
    </div>
  </div>`;
}

/* Icône ronde "Fond" (boussole/navigation façon icône de localisation) */
const LP_FOND_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="lpFondGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5eb2ff"/>
      <stop offset="1" stop-color="#0a7cff"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="#ffffff"/>
  <circle cx="50" cy="50" r="41" fill="url(#lpFondGrad)"/>
  <path d="M50 22 L69 70 L50 58 L31 70 Z" fill="#ffffff"/>
</svg>`);

function buildLaunchpadHTML(){
  const tab = state.launchpadTab || 'apps';
  const tabsBar = `<div class="launchpad-tabs">
    <div class="launchpad-tab" data-active="${tab==='apps'}" data-gaze data-action="launchpad:tab:apps">
      <span class="lp-tab-ico">▦</span><span>Apps</span>
    </div>
    <div class="launchpad-tab" data-active="${tab==='galerie'}" data-gaze data-action="launchpad:tab:galerie">
      <span class="lp-tab-ico">📁</span><span>Galerie</span>
    </div>
    <div class="launchpad-tab" data-active="${tab==='library'}" data-gaze data-action="launchpad:tab:library">
      <span class="lp-tab-ico">🗂️</span><span>Library</span>
    </div>
    <div class="launchpad-tab" data-active="${tab==='fond'}" data-gaze data-action="launchpad:tab:fond">
      <img src="${LP_FOND_ICON}"><span>Fond</span>
    </div>
  </div>`;

  const appsGridHTML = `<div class="launchpad-grid">
      ${LAUNCHPAD_APPS.map(a => {
        const action = a.id.includes(':') ? a.id : 'app:' + a.id;
        const iconSrc = state.dockIcons && state.dockIcons[a.id];
        return `
          <div class="lp-app" data-gaze data-action="${action}">
            ${iconSrc ? `<img src="${iconSrc}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;display:block;margin:0 auto">` : a.customIcon ? `<img src="${a.customIcon}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;display:block;margin:0 auto">` : `<div class="lp-ico">${a.icon}</div>`}
            <div class="lp-name">${a.name}</div>
          </div>`;
      }).join('')}
    </div>`;

  const mainScenes = SCENES.filter(s => s.main);
  const otherIsCurrent = mainScenes.length === 2 && state.scene && state.scene.id === mainScenes[1].id;
  const toggleTargetName = mainScenes.length === 2 ? (otherIsCurrent ? mainScenes[0].name : mainScenes[1].name) : '';
  const toggleBtnHTML = mainScenes.length === 2 ? `
    <div class="pill glass-soft" data-gaze data-action="scene:toggleMain"
         style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:9px 14px;font-size:12px;cursor:pointer">
      <span style="font-size:15px">🔄</span>
      <span>Basculer le fond principal → <b>${toggleTargetName}</b></span>
    </div>` : '';

  const bgGridHTML = `<div class="lp-bg-tab-wrap">
    ${toggleBtnHTML}
    <div class="lp-bg-grid" style="max-height:56vh;overflow-y:auto">
      ${SCENES.map(s => `
        <div class="lp-bg" data-gaze data-action="scene:${s.id}" style="background-image:url('${s.url}')">
          ${s.main ? `<div class="lp-bg-main-badge" style="position:absolute;top:6px;right:6px;background:rgba(10,124,255,.85);color:#fff;font-size:9px;padding:2px 6px;border-radius:8px">Principal</div>` : ''}
          <div class="lp-bg-label">${s.name}</div>
        </div>`).join('')}
    </div>
  </div>`;

  const libraryHTML = tab === 'library' ? buildLaunchpadLibraryHTML() : '';
  const galerieHTML = tab === 'galerie' ? buildLaunchpadGalerieHTML() : '';

  return `<div class="launchpad" style="position:relative">
    <div class="launchpad-title">Launchpad</div>
    ${tabsBar}
    ${tab === 'fond' ? bgGridHTML : tab === 'library' ? libraryHTML : tab === 'galerie' ? galerieHTML : appsGridHTML}
    <div class="launchpad-exit glass-soft" data-gaze data-action="closeLaunchpad">✕ Fermer</div>
    ${state.addGameModalOpen ? buildAddGameModalHTML() : ''}
  </div>`;
}

/* ------------ Launchpad · onglet Galerie (Galerie / Scènes / VR Meet Up /
   Divertissement) — anciennement affiché en permanence sur le grand écran
   d'accueil (buildDockHTML), déplacé ici pour ne plus flotter en continu
   devant l'utilisateur : on n'y accède plus que depuis le Launchpad. ------- */
function buildLaunchpadGalerieHTML(){
  const vhTab = state.vhHomeTab || 'galerie';

  const subTabsHTML = `<div class="vh-tabbar" style="margin-bottom:10px">
    <div class="vh-tab${vhTab==='galerie'?' active':''}" data-gaze data-action="vhTab:galerie">📁 Galerie</div>
    <div class="vh-tab${vhTab==='scenes'?' active':''}" data-gaze data-action="vhTab:scenes">🌍 Scènes</div>
    <div class="vh-tab${vhTab==='vrmeetup'?' active':''}" data-gaze data-action="vhTab:vrmeetup">👥 VR Meet Up</div>
    <div class="vh-tab${vhTab==='entertainment'?' active':''}" data-gaze data-action="vhTab:entertainment">🎬 Divertissement</div>
  </div>`;

  let tabContent = '';
  if(vhTab === 'galerie'){
    const userItems = state.userMedia;
    const exterieurs = SCENES.slice(0, 16);
    const interieurs = SCENES.slice(16);
    const renderSection = (title, items) => items.length === 0 ? '' : `
      <div style="font-size:11px;font-weight:600;opacity:.7;margin:10px 0 5px;letter-spacing:.5px">${title}</div>
      <div class="grid-4">${items.map(i => thumbHtml(i, true)).join('')}</div>
    `;
    tabContent = `
    <div id="galleryScroll" style="max-height:56vh;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth;padding-right:4px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;opacity:.8">📁 Galerie & Arrière-plans</div>
        <div class="pill glass-soft" style="font-size:9px" data-gaze data-action="addFiles">＋ Importer</div>
      </div>
      ${userItems.length > 0 ? `
        <div style="font-size:11px;font-weight:600;opacity:.7;margin:4px 0 5px">📁 Mes médias</div>
        <div class="grid-4">
          <div class="add-btn" data-gaze data-action="addFiles">＋ Ajouter</div>
          ${userItems.map(i => thumbHtml(i, true)).join('')}
        </div>
      ` : `<div class="add-btn" style="margin-bottom:10px" data-gaze data-action="addFiles">＋ Ajouter une photo / vidéo 360°</div>`}
      ${renderSection('🌿 Extérieurs & Nature', exterieurs)}
      ${renderSection('🏠 Intérieurs', interieurs)}
    </div>
    <div class="gaze-scroll-bar">
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-up">▲</div>
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-up2" style="font-size:12px;opacity:.7">▲▲</div>
      <div style="width:2px;height:18px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto"></div>
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-down2" style="font-size:12px;opacity:.7">▼▼</div>
      <div class="gaze-scroll-btn" data-gaze data-action="gallery-scroll-down">▼</div>
    </div>`;
  } else if(vhTab === 'scenes'){
    const exterieurs = SCENES.slice(0,8);
    const interieurs = SCENES.slice(8,16);
    tabContent = `
    <div id="galleryScroll" style="max-height:56vh;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth">
      <div style="font-size:11px;font-weight:600;opacity:.7;margin:4px 0 5px">🌿 Extérieurs</div>
      <div class="grid-4">${exterieurs.map(i => thumbHtml(i, true)).join('')}</div>
      <div style="font-size:11px;font-weight:600;opacity:.7;margin:10px 0 5px">🏠 Intérieurs</div>
      <div class="grid-4">${interieurs.map(i => thumbHtml(i, true)).join('')}</div>
    </div>`;
  } else if(vhTab === 'vrmeetup'){
    tabContent = `<div style="text-align:center;padding:30px 20px">
      <div style="font-size:40px;margin-bottom:12px">👥</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:8px">VR Meet Up</div>
      <div style="font-size:12px;opacity:.6;margin-bottom:18px">Retrouve tes amis dans l'espace virtuel</div>
      <div class="pill glass-soft" style="display:inline-block" data-gaze data-action="toast:Rejoindre">🚀 Rejoindre une salle</div>
    </div>`;
  } else if(vhTab === 'entertainment'){
    tabContent = `<div style="display:flex;flex-direction:column;gap:10px;padding:10px 0">
      <div style="font-size:12px;font-weight:700;opacity:.8;margin-bottom:4px">🎬 Divertissement</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="tile glass-soft" data-gaze data-action="app:netflix" style="flex:1;min-width:80px;align-items:center;padding:14px">
          <div style="font-size:24px;color:#e50914;font-weight:900">N</div><div class="tile-sub">Netflix</div>
        </div>
        <div class="tile glass-soft" data-gaze data-action="app:appletv" style="flex:1;min-width:80px;align-items:center;padding:14px">
          <div style="font-size:24px">📺</div><div class="tile-sub">Apple TV</div>
        </div>
        <div class="tile glass-soft" data-gaze data-action="app:disney" style="flex:1;min-width:80px;align-items:center;padding:14px">
          <div style="font-size:16px;color:#4d9fff;font-weight:900">Disney+</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <div class="tile glass-soft" data-gaze data-action="app:youtube" style="flex:1;align-items:center;padding:12px">
          <div style="font-size:22px">▶️</div><div class="tile-sub">YouTube</div>
        </div>
        <div class="tile glass-soft" data-gaze data-action="app:applemusic" style="flex:1;align-items:center;padding:12px">
          <div style="font-size:22px">🎵</div><div class="tile-sub">Apple Music</div>
        </div>
      </div>
    </div>`;
  }

  return `<div>${subTabsHTML}${tabContent}</div>`;
}

/* ------------ Launchpad · onglet Library (façon Meta Quest) ------------ */
function buildLaunchpadLibraryHTML(){
  const filter = state.libraryFilter || 'apps';
  const search = (state.librarySearch || '').toLowerCase();
  const customGames = state.customGames || [];

  const sidebarItems = [
    { id:'apps',      icon:'👤', label:'Apps' },
    { id:'worlds',    icon:'🌍', label:'Worlds' },
    { id:'downloads', icon:'⬇️', label:'Downloads' },
  ];
  const sidebarHTML = `<div class="lib-sidebar">
    <div class="lib-side-item${filter==='all'?' active':''}" data-gaze data-action="library:filter:all">
      <span class="lib-side-ico">▦</span><span>All</span>
    </div>
    ${sidebarItems.map(s => `
      <div class="lib-side-item${filter===s.id?' active':''}" data-gaze data-action="library:filter:${s.id}">
        <span class="lib-side-ico">${s.icon}</span><span>${s.label}</span>
      </div>`).join('')}
    <div class="lib-side-item" data-gaze data-action="library:addgame:open" style="margin-top:10px;color:#ffb020">
      <span class="lib-side-ico">➕</span><span>Get more apps</span>
    </div>
  </div>`;

  const appTiles = (filter==='downloads') ? [] : LAUNCHPAD_APPS
    .filter(a => !search || a.name.toLowerCase().includes(search))
    .map(a => {
      const action = a.id.includes(':') ? a.id : 'app:' + a.id;
      const iconSrc = state.dockIcons && state.dockIcons[a.id];
      return `<div class="lib-tile" data-gaze data-action="${action}">
        <div class="lib-tile-ico">
          ${iconSrc ? `<img src="${iconSrc}">` : a.customIcon ? `<img src="${a.customIcon}">` : `<span>${a.icon}</span>`}
        </div>
        <div class="lib-tile-name">${a.name}</div>
      </div>`;
    }).join('');

  const gameTiles = (filter==='apps') ? '' : customGames
    .filter(g => !search || g.name.toLowerCase().includes(search))
    .map(g => `
      <div class="lib-tile lib-tile-game" data-gaze data-action="library:game:launch:${g.id}">
        <div class="lib-tile-ico lib-tile-cover">🎮</div>
        <div class="lib-tile-name">${escapeHtml(g.name)}</div>
        <div class="lib-tile-sub">${g.mode==='fullscreen'?'📺 Plein écran':'🖥️ Tablette'} · 📁 ${g.fileCount||'?'} fichiers</div>
        <div class="lib-tile-del" data-gaze data-action="library:game:delete:${g.id}" title="Supprimer">🗑</div>
      </div>`).join('');

  const addTileHTML = (filter==='downloads' || filter==='all') ? `
    <div class="lib-tile lib-tile-add" data-gaze data-action="library:addgame:open">
      <div class="lib-tile-ico"><span>➕</span></div>
      <div class="lib-tile-name">Ajouter un jeu</div>
    </div>` : '';

  const cinemaTileHTML = (filter!=='worlds') ? `
    <div class="lib-tile lib-tile-cinema" data-gaze data-action="cinemaroom:pick">
      <div class="lib-tile-ico"><span>🎬</span></div>
      <div class="lib-tile-name">Cinéma</div>
      <div class="lib-tile-sub">Choisir un film/série</div>
    </div>` : '';

  const emptyHTML = (filter==='downloads' && !customGames.length) ? `
    <div style="grid-column:1/-1;text-align:center;opacity:.55;padding:16px;font-size:12px">
      Aucun jeu téléchargé. Ajoutez un jeu HTML/JS ci-dessous.
    </div>` : '';

  return `<div class="library-screen">
    <div class="library-header">
      <div class="library-title">Library</div>
      <div class="library-search">
        <span>🔍</span>
        <input type="text" placeholder="Search" value="${state.librarySearch ? escapeHtml(state.librarySearch) : ''}"
          oninput="state.librarySearch=this.value;renderHUD()">
      </div>
    </div>
    <div class="library-body">
      ${sidebarHTML}
      <div class="library-grid">
        ${appTiles}
        ${gameTiles}
        ${cinemaTileHTML}
        ${addTileHTML}
        ${emptyHTML}
      </div>
    </div>
  </div>`;
}

/* ------------ Fenêtre « tablette » pour un jeu HTML/JS custom (iPad devant soi) ------------ */
function buildCustomGameTabletHTML(id){
  const game = (state.customGames||[]).find(g => g.id === id);
  if(!game){
    return `<div class="app-window glass" id="appWinEl" style="position:relative">
      <div class="app-window-header">
        <div class="app-window-title">🎮 Jeu introuvable</div>
        <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
      </div>
    </div>`;
  }
  const maxBtn = `<div class="app-win-maximize glass-soft" data-gaze data-action="toggleMaximize" title="Centrer/Agrandir">⤢</div>`;
  const dragArmed = state.dragGazeMode;
  const dragHandle = `
    <div class="app-win-drag${dragArmed?' drag-armed':''}" id="appWinDrag"
      data-gaze data-action="${dragArmed ? 'drag:deactivate' : 'drag:activate'}"
      title="${dragArmed ? 'Mode déplacement actif' : 'Déplacer la fenêtre'}">✥</div>
    ${dragArmed ? `
    <div class="drag-confirm-btn" data-gaze data-action="drag:confirm" title="Valider (2s)">✓</div>
    <div class="drag-cancel-btn" data-gaze data-action="drag:cancel" title="Annuler">✕</div>
    <div class="drag-hint-label">✥ Tournez la tête pour déplacer</div>` : ''}
  `;
  const resizeArmed = state.resizeGazeMode;
  const resizeHandle = `
    <div class="app-win-resize${resizeArmed?' resize-armed':''}" id="appWinResize"
      data-gaze data-action="${resizeArmed ? 'resize:deactivate' : 'resize:activate'}"
      title="${resizeArmed ? 'Regarder pour désarmer' : 'Regarder pour redimensionner'}">${resizeArmed?'↔':'⇲'}</div>
    ${resizeArmed ? `
    <div class="resize-confirm-btn" data-gaze data-action="resize:confirm" title="Valider (2s)">✓</div>
    <div class="resize-cancel-btn" data-gaze data-action="resize:cancel" title="Annuler">✕</div>
    <div class="resize-hint-label">↔ tête gauche/droite · ↕ haut/bas</div>` : ''}
  `;
  const depthBar = `<div class="app-win-depth" data-gaze data-action="depth:grab">
    <span class="depth-dot"></span><span class="depth-dot"></span><span class="depth-dot"></span>
  </div>`;
  const controlsOpen = state.cgControlsOpen !== false;
  const controlsToggleBtn = `<div class="cg-controls-toggle" data-gaze data-action="customgame:controls:toggle"
    title="${controlsOpen ? 'Masquer clavier/souris' : 'Afficher clavier/souris'}">${controlsOpen ? '⌨️' : '🕹️'}</div>`;
  const controlsPanel = controlsOpen ? `
    <div class="cg-controls">
      <div class="cg-controls-col cg-keys">
        <div class="cg-key-row"><div class="cg-key" data-cg-key="ArrowUp" data-cg-code="ArrowUp">↑</div></div>
        <div class="cg-key-row">
          <div class="cg-key" data-cg-key="ArrowLeft" data-cg-code="ArrowLeft">←</div>
          <div class="cg-key" data-cg-key="ArrowDown" data-cg-code="ArrowDown">↓</div>
          <div class="cg-key" data-cg-key="ArrowRight" data-cg-code="ArrowRight">→</div>
        </div>
        <div class="cg-key-row" style="margin-top:4px"><div class="cg-key" data-cg-key="w" data-cg-code="KeyW">W</div></div>
        <div class="cg-key-row">
          <div class="cg-key" data-cg-key="a" data-cg-code="KeyA">A</div>
          <div class="cg-key" data-cg-key="s" data-cg-code="KeyS">S</div>
          <div class="cg-key" data-cg-key="d" data-cg-code="KeyD">D</div>
        </div>
        <div class="cg-key-row" style="margin-top:4px">
          <div class="cg-key cg-key-wide" data-cg-key=" " data-cg-code="Space">Espace</div>
          <div class="cg-key" data-cg-key="Shift" data-cg-code="ShiftLeft">⇧</div>
          <div class="cg-key" data-cg-key="Enter" data-cg-code="Enter">↵</div>
          <div class="cg-key" data-cg-key="Escape" data-cg-code="Escape">Esc</div>
        </div>
      </div>
      <div class="cg-controls-col cg-mouse">
        <div class="cg-trackpad" id="cgTrackpad"><span class="cg-trackpad-hint">🖱️ Glisser pour bouger la souris</span></div>
        <div class="cg-mouse-buttons">
          <div class="cg-mouse-btn" data-cg-mouse="left">Clic gauche</div>
          <div class="cg-mouse-btn" data-cg-mouse="right">Clic droit</div>
        </div>
      </div>
    </div>` : '';
  const stylusHeld = state.cgStylusHeld === true;
  const stylusDock = `<div class="cg-stylus-dock${stylusHeld?' held':''}" id="cgStylusDock"
    data-gaze data-action="customgame:stylus:toggle"
    title="${stylusHeld ? 'Reposer le stylet' : 'Prendre le stylet'}">🖊️</div>`;
  return `<div class="app-window glass cg-tablet-shell" id="appWinEl" style="width:760px;position:relative;padding:0;overflow:hidden">
    <div class="cg-tablet-camera-dot"></div>
    ${stylusDock}
    <div class="app-window-header">
      <div class="app-window-title">🎮 ${escapeHtml(game.name)} <span style="opacity:.5;font-size:10px;margin-left:6px">🖥️ Mode tablette</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        ${controlsToggleBtn}
        ${dragHandle}
        ${maxBtn}
        <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
      </div>
    </div>
    <div class="app-window-body" style="min-height:480px;padding:0;overflow:hidden;display:flex;flex-direction:column">
      <iframe class="customgame-frame" id="cgFrame" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
        allow="xr-spatial-tracking; camera; microphone; autoplay; gamepad"
        src="${(state.customGameRuntimeUrls && state.customGameRuntimeUrls[game.id]) || ''}" style="flex:1;min-height:0"></iframe>
      ${controlsPanel}
    </div>
    ${resizeHandle}${depthBar}
  </div>`;
}

/* ------------ Modale « Ajouter un jeu » (HTML/JS custom) ------------ */
function buildAddGameModalHTML(){
  const f = state.addGameForm || { name:'', mode:'fullscreen', folderFiles:null, folderName:'', entryFile:'', htmlCandidates:[] };
  return `<div class="creator-overlay">
    <div class="creator-menu" style="width:520px;max-height:520px">
      <div class="creator-title">
        <span>➕ Ajouter un jeu HTML/JS</span>
        <div class="creator-close" data-gaze data-action="library:addgame:close">✕</div>
      </div>
      <div class="creator-form">
        ${state.addGameError ? `
        <div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);
          border-radius:10px;padding:10px 12px;font-size:11px;line-height:1.5;color:#fecaca;
          display:flex;align-items:flex-start;gap:8px">
          <span style="font-size:14px">⚠️</span>
          <span style="flex:1">${escapeHtml(state.addGameError)}</span>
          <span data-gaze data-action="library:addgame:dismisserror"
            style="cursor:pointer;opacity:.7;font-weight:700">✕</span>
        </div>` : ''}
        <div class="creator-field">
          <span class="creator-label">Nom du jeu <span style="opacity:.5;font-weight:400">(optionnel)</span></span>
          <div class="creator-input" data-gaze data-action="library:addgame:edit:name"
            style="min-height:28px;cursor:pointer">${f.name ? escapeHtml(f.name) : '<span style="opacity:.4">Toucher pour taper le nom…</span>'}</div>
        </div>
        <div class="creator-field" style="flex:1">
          <span class="creator-label">Jeu (dossier, ou fichier .zip du jeu)</span>
          <input type="file" id="addGameFolderInput" webkitdirectory directory multiple
            style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden"
            onchange="handleAddGameFolderSelect(this.files)">
          <input type="file" id="addGameZipInput" accept=".zip,application/zip,application/x-zip-compressed"
            style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden"
            onchange="handleAddGameZipSelect(this.files)">
          <div data-gaze data-action="library:addgame:pickfolder" class="creator-folder-drop"
            style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
              min-height:110px;border:2px dashed rgba(255,255,255,0.28);border-radius:14px;
              cursor:pointer;text-align:center;padding:14px;background:rgba(255,255,255,0.04)">
            ${f.folderFiles && f.folderFiles.length ? `
              <span style="font-size:22px">${f.sourceType==='zip'?'🗜️':'📁'}</span>
              <span style="font-size:12px;font-weight:600">${escapeHtml(f.folderName||'Dossier')} — ${f.folderFiles.length} fichier${f.folderFiles.length>1?'s':''}</span>
              <span style="font-size:10px;opacity:.6">Entrée : ${escapeHtml(f.entryFile||'?')} · toucher pour changer de dossier</span>
            ` : `
              <span style="font-size:26px">👆📁</span>
              <span style="font-size:12px;font-weight:600">Toucher l'écran pour importer un dossier</span>
              <span style="font-size:10px;opacity:.6">Sélectionne le dossier contenant index.html + fichiers .js/.css</span>
            `}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin:8px 0;opacity:.5;font-size:9px;text-transform:uppercase;letter-spacing:.5px">
            <div style="flex:1;height:1px;background:rgba(255,255,255,0.15)"></div>OU<div style="flex:1;height:1px;background:rgba(255,255,255,0.15)"></div>
          </div>
          <div data-gaze data-action="library:addgame:pickzip" class="creator-folder-drop"
            style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
              min-height:70px;border:2px dashed rgba(168,85,247,0.4);border-radius:14px;
              cursor:pointer;text-align:center;padding:12px;background:rgba(168,85,247,0.06)">
            <span style="font-size:20px">🗜️📁</span>
            <span style="font-size:12px;font-weight:600">Importer un fichier .zip</span>
            <span style="font-size:10px;opacity:.6">Il sera dézippé automatiquement</span>
          </div>
          ${(f.htmlCandidates && f.htmlCandidates.length > 1) ? `
            <div style="margin-top:8px">
              <span class="creator-label" style="font-size:10px">Fichier de lancement</span>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                ${f.htmlCandidates.map(p => `
                  <div class="creator-pick-btn${f.entryFile===p?' active':''}" style="font-size:10px;padding:6px 10px"
                    data-gaze data-action="library:addgame:entryfile:${encodeURIComponent(p)}">${escapeHtml(p)}</div>
                `).join('')}
              </div>
            </div>` : ''}
        </div>
        <div class="creator-field">
          <span class="creator-label">Mode de lancement</span>
          <div style="display:flex;gap:8px">
            <div class="creator-pick-btn${f.mode==='fullscreen'?' active':''}" style="flex:1"
              data-gaze data-action="library:addgame:mode:fullscreen">📺 Plein écran (stéréo + hand tracking)</div>
            <div class="creator-pick-btn${f.mode==='tablet'?' active':''}" style="flex:1"
              data-gaze data-action="library:addgame:mode:tablet">🖥️ Tablette (iPad devant soi)</div>
          </div>
        </div>
        <div class="creator-save-btn" style="background:linear-gradient(135deg,#22c55e,#16a34a)"
          data-gaze data-action="library:addgame:save">💾 Enregistrer &amp; ajouter à la Library</div>
      </div>
    </div>
  </div>`;
}

function buildHideCrossHTML(){
  return `<div class="hide-cross" data-gaze data-action="showMenu">❌</div>`;
}

function buildCinemaCtrlHTML(){
  const playing = $('userVid') && !$('userVid').paused;
  const scrub = state.scrubMode;
  return `<div class="cinema-ctrl${scrub ? ' scrub-active' : ''}">
    <button data-gaze data-action="cinema:skipback">⏪</button>
    <button data-gaze data-action="cinema:playpause">${playing ? '⏸' : '▶️'}</button>
    <button data-gaze data-action="cinema:skipfwd">⏩</button>
    <div class="progress-wrap" id="progressWrap">
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <div class="progress-thumb${scrub ? ' scrub-thumb' : ''}" id="progressThumb"
        data-gaze data-action="${scrub ? 'cinema:scrub:confirm' : 'cinema:scrub:activate'}"
        style="left:0%"
        title="${scrub ? 'Regardez 2s pour valider' : 'Regardez pour déplacer'}">
        ${scrub ? '<div class="scrub-ring"></div>' : ''}
      </div>
    </div>
    ${scrub ? `<div class="scrub-cancel" data-gaze data-action="cinema:scrub:cancel">✕</div>` : ''}
  </div>`;
}

/* ------------ App Window ------------ */
function buildAppWindowHTML(){
  // Cas spécial Sims 3 VR : plein-écran immersif sans fenêtre
  if(state.activeApp === 'sims3' && sims3State.open){
    const content = buildSims3Content();
    return `<div id="sims3-win" style="
      width:1280px;height:720px;position:relative;overflow:hidden;border-radius:0;
      background:linear-gradient(135deg,#0a2a0a 0%,#1a3a1a 40%,#0f2a0f 100%);
    ">
      <!-- Barre diamant Sims -->
      <div style="position:absolute;top:0;left:0;right:0;height:3px;
        background:linear-gradient(90deg,#22c55e,#4ade80,#22c55e);z-index:10;pointer-events:none"></div>
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);
        width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;
        border-top:12px solid #22c55e;z-index:11;pointer-events:none;margin-top:3px"></div>
      ${content}
    </div>`;
  }
  if(typeof state.activeApp === 'string' && state.activeApp.startsWith('customgame:')){
    return buildCustomGameTabletHTML(state.activeApp.slice(11));
  }
  const app = APPS.find(a => a.id === state.activeApp);
  if(!app) return '';
  const isNotes  = app.id === 'notes';
  const isMaison = app.id === 'maison';
  const isVisionHome = app.id === 'visionhome';
  const isNetflix = app.id === 'netflix';
  const isDisney  = app.id === 'disney';
  const isAppleTV = app.id === 'appletv';
  const isAppleMusic = app.id === 'applemusic';
  const isGameLauncher = app.id === 'gamelauncher';
  const isSafari  = app.id === 'safari';
  // Maximize => centré, sinon offset gauche
  const maxBtn = `<div class="app-win-maximize glass-soft" data-gaze data-action="toggleMaximize" title="Centrer/Agrandir">⤢</div>`;
  const resizeArmed = state.resizeGazeMode;
  const resizeHandle = `
    <div class="app-win-resize${resizeArmed?' resize-armed':''}" id="appWinResize"
      data-gaze data-action="${resizeArmed ? 'resize:deactivate' : 'resize:activate'}"
      title="${resizeArmed ? 'Regarder pour désarmer' : 'Regarder pour redimensionner'}">
      ${resizeArmed ? '↔' : '⇲'}
    </div>
    ${resizeArmed ? `
    <div class="resize-confirm-btn" data-gaze data-action="resize:confirm" title="Valider (2s)">✓</div>
    <div class="resize-cancel-btn" data-gaze data-action="resize:cancel" title="Annuler">✕</div>
    <div class="resize-hint-label">↔ tête gauche/droite · ↕ haut/bas</div>
    ` : ''}
  `;

  const depthBar = `<div class="app-win-depth" data-gaze data-action="depth:grab">
    <span class="depth-dot"></span>
    <span class="depth-dot"></span>
    <span class="depth-dot"></span>
  </div>`;

  const dragArmed = state.dragGazeMode;
  const dragHandle = `
    <div class="app-win-drag${dragArmed?' drag-armed':''}" id="appWinDrag"
      data-gaze data-action="${dragArmed ? 'drag:deactivate' : 'drag:activate'}"
      title="${dragArmed ? 'Mode déplacement actif' : 'Déplacer la fenêtre'}">
      ${dragArmed ? '✥' : '✥'}
    </div>
    ${dragArmed ? `
    <div class="drag-confirm-btn" data-gaze data-action="drag:confirm" title="Valider (2s)">✓</div>
    <div class="drag-cancel-btn" data-gaze data-action="drag:cancel" title="Annuler">✕</div>
    <div class="drag-hint-label">✥ Tournez la tête pour déplacer</div>
    ` : ''}
  `;

  if(isNetflix){
    return `<div class="app-window netflix-win" id="appWinEl" style="position:relative">
      <div class="app-window-header">
        <div class="app-window-title" style="color:#e50914;font-weight:900;letter-spacing:1px">N NETFLIX</div>
        <div style="display:flex;gap:8px;align-items:center">
          ${dragHandle}
          ${maxBtn}
          <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
        </div>
      </div>
      <div class="app-window-body" style="min-height:unset;padding:0;overflow:hidden">
        ${buildNetflixHTML()}
      </div>
      ${resizeHandle}${depthBar}
    </div>`;
  }
  if(isDisney){
    return `<div class="app-window netflix-win" id="appWinEl" style="width:820px;position:relative">
      <div class="app-window-header" style="background:rgba(6,13,31,0.95);border-bottom:1px solid rgba(255,255,255,0.08)">
        <div class="app-window-title" style="display:flex;align-items:center;gap:4px">
          <svg viewBox="0 0 100 28" width="60" height="18" xmlns="http://www.w3.org/2000/svg"><text x="0" y="22" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="24" fill="#4d9fff">Disney</text></svg>
          <span style="color:#4d9fff;font-weight:900;font-size:16px;line-height:1">+</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${dragHandle}
          ${maxBtn}
          <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
        </div>
      </div>
      <div class="app-window-body" style="min-height:unset;padding:0;overflow:hidden">
        ${buildDisneyHTML()}
      </div>
      ${resizeHandle}${depthBar}
    </div>`;
  }
  if(isAppleTV){
    return `<div class="app-window glass" id="appWinEl" style="width:900px;background:transparent;border:none;box-shadow:none;padding:0;position:relative">
      <div class="app-window-body" style="min-height:unset;position:relative;padding:0;overflow:hidden">
        <div class="vh-close" data-gaze data-action="closeApp">✕</div>
        ${maxBtn}
        <div style="position:absolute;top:8px;left:50px;display:flex;gap:6px;z-index:55">${dragHandle}</div>
        ${buildAppleTVHTML()}
      </div>
      ${resizeHandle}${depthBar}
    </div>`;
  }
  if(isAppleMusic){
    return `<div class="app-window glass" id="appWinEl" style="width:940px;background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);padding:0;position:relative;overflow:visible">
      <div class="app-window-header" style="background:#111;border-bottom:1px solid rgba(255,255,255,0.07)">
        <div class="app-window-title" style="display:flex;align-items:center;gap:6px;color:#fa2d55;font-weight:700">
          <div style="width:22px;height:22px;background:linear-gradient(135deg,#fc3c44,#fa2d55);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px">🎵</div>
          Apple Music
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${dragHandle}
          ${maxBtn}
          <div class="app-win-minimize glass-soft" data-gaze data-action="am:minimize" title="Mini Player" style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer">−</div>
          <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
        </div>
      </div>
      <div class="app-window-body" style="min-height:unset;padding:0;overflow:hidden">
        ${buildAppleMusicHTML()}
      </div>
      ${resizeHandle}${depthBar}
    </div>`;
  }
  if(isVisionHome){
    return `<div class="app-window glass" id="appWinEl" style="width:684px;background:transparent;border:none;box-shadow:none;position:relative">
      <div class="app-window-body" style="min-height:unset;position:relative">
        <div class="vh-close" data-gaze data-action="closeApp">✕</div>
        ${maxBtn}
        <div style="position:absolute;top:8px;left:50px;z-index:55">${dragHandle}</div>
        ${buildAppBodyHTML(app.id)}
      </div>
      ${resizeHandle}${depthBar}
    </div>`;
  }
  if(isGameLauncher){
    return `<div class="app-window glass" id="appWinEl" style="width:900px;background:transparent;border:none;box-shadow:none;padding:0;position:relative">
      <div class="app-window-header" style="background:transparent;border-bottom:none;padding:6px 10px 0;">
        <div style="display:flex;gap:8px;align-items:center;margin-left:auto">
          ${dragHandle}
          ${maxBtn}
          <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
        </div>
      </div>
      <div class="app-window-body" style="min-height:unset;padding:0;">
        ${buildAppBodyHTML(app.id)}
      </div>
      ${resizeHandle}${depthBar}
    </div>`;
  }
  if(isSafari){
    return `<div class="app-window glass safari-win" id="appWinEl" style="position:relative">
      <div class="app-window-header">
        <div class="app-window-title">🧭 Safari</div>
        <div style="display:flex;gap:8px;align-items:center">
          ${dragHandle}
          ${maxBtn}
          <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
        </div>
      </div>
      <div class="app-window-body" style="min-height:unset;flex:1;overflow:hidden;display:flex;flex-direction:column">
        ${buildBrowserHTML()}
      </div>
      ${resizeHandle}${depthBar}
    </div>`;
  }
  const w = isMaison ? '880px' : isNotes ? '580px' : '';
  const cls = isMaison ? ' light-mode' : '';
  return `<div class="app-window glass${cls}" id="appWinEl" ${w ? `style="width:${w};position:relative"` : 'style="position:relative"'}>
    <div class="app-window-header">
      <div class="app-window-title">${app.icon} ${app.name}</div>
      <div style="display:flex;gap:8px;align-items:center">
        ${dragHandle}
        ${maxBtn}
        <div class="app-window-close glass-soft" data-gaze data-action="closeApp">✕</div>
      </div>
    </div>
    <div class="app-window-body" ${(isNotes||isMaison) ? 'style="min-height:unset"' : ''}>
      ${buildAppBodyHTML(app.id)}
    </div>
    ${resizeHandle}
  </div>`;
}
