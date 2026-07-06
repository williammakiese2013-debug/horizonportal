// ui.js
// Toute l'interface additionnelle du jeu : menu principal (choix du mode),
// HUD du mode histoire (santé, objectif, boîte de dialogue narrative,
// barre de vie du boss), écrans de fin (mort / victoire).
// Comme mobileControls.js, ce module crée son propre DOM en JS.

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .wh-menu {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at center, rgba(11,14,20,0.55) 0%, rgba(6,7,10,0.92) 75%);
      font-family: system-ui, sans-serif;
      color: #f4f4f4;
      text-align: center;
      padding: 20px;
    }
    .wh-menu h1 {
      font-size: clamp(32px, 6vw, 64px);
      margin: 0 0 6px 0;
      letter-spacing: 2px;
      text-shadow: 0 0 24px rgba(255,60,60,0.55);
    }
    .wh-menu .wh-subtitle {
      font-size: clamp(13px, 2vw, 16px);
      color: #c9ccd3;
      margin-bottom: 34px;
      max-width: 560px;
      line-height: 1.5;
    }
    .wh-menu-buttons {
      display: flex;
      gap: 22px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .wh-menu-btn {
      cursor: pointer;
      background: rgba(122, 22, 32, 0.35);
      border: 2px solid rgba(255,255,255,0.35);
      color: #fff;
      padding: 18px 30px;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 700;
      min-width: 200px;
      transition: background 0.2s, transform 0.15s;
    }
    .wh-menu-btn:hover { background: rgba(200, 40, 50, 0.55); transform: translateY(-2px); }
    .wh-menu-btn .wh-btn-desc {
      display: block;
      font-weight: 400;
      font-size: 12px;
      margin-top: 6px;
      color: #e5e5ea;
      opacity: 0.85;
    }
    .wh-menu-hint {
      margin-top: 30px;
      font-size: 11px;
      color: #9a9da5;
    }

    .wh-hud { position: fixed; inset: 0; pointer-events: none; z-index: 40; font-family: system-ui, sans-serif; }

    .wh-health-wrap {
      position: fixed;
      left: 16px;
      bottom: 16px;
      width: 240px;
      display: none;
    }
    .wh-health-label { color: #eee; font-size: 11px; margin-bottom: 4px; text-shadow: 0 1px 2px #000; }
    .wh-health-bar-bg {
      width: 100%; height: 16px; border-radius: 8px;
      background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3); overflow: hidden;
    }
    .wh-health-bar-fg { height: 100%; width: 100%; background: #4ade80; transition: width 0.25s, background 0.25s; }

    .wh-objective {
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10,12,18,0.6);
      color: #f4f4f4;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      max-width: 90vw;
      text-align: center;
      display: none;
    }

    .wh-chapter-card {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0);
      color: #fff;
      font-size: clamp(20px, 4vw, 40px);
      font-weight: 700;
      text-align: center;
      text-shadow: 0 0 20px rgba(0,0,0,0.9);
      opacity: 0;
      transition: opacity 0.9s ease;
      pointer-events: none;
      z-index: 45;
      padding: 20px;
    }
    .wh-chapter-card.show { opacity: 1; }

    .wh-dialogue {
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      width: min(680px, 90vw);
      background: rgba(8,9,13,0.78);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 14px 18px;
      color: #f4f4f4;
      display: none;
      pointer-events: auto;
      cursor: pointer;
    }
    .wh-dialogue .wh-speaker {
      font-size: 12px;
      font-weight: 700;
      color: #ff8a8a;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .wh-dialogue .wh-line { font-size: 14px; line-height: 1.5; }
    .wh-dialogue .wh-skip {
      float: right;
      font-size: 11px;
      color: #b8bac0;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 6px;
      padding: 2px 8px;
      margin-left: 10px;
    }

    .wh-boss-wrap {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      width: min(520px, 92vw);
      display: none;
      text-align: center;
    }
    .wh-boss-name { color: #ffb3b3; font-weight: 700; font-size: 15px; letter-spacing: 1px; margin-bottom: 6px; text-shadow: 0 1px 3px #000; }
    .wh-boss-bar-bg { width: 100%; height: 14px; border-radius: 7px; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,90,90,0.5); overflow: hidden; }
    .wh-boss-bar-fg { height: 100%; width: 100%; background: linear-gradient(90deg,#ff3b3b,#ff8a3d); transition: width 0.25s; }

    .wh-flash {
      position: fixed; inset: 0; background: rgba(200,20,20,0.35);
      opacity: 0; pointer-events: none; z-index: 50; transition: opacity 0.15s;
    }
    .wh-flash.on { opacity: 1; }

    .wh-overlay {
      position: fixed; inset: 0; z-index: 90;
      display: none; align-items: center; justify-content: center; flex-direction: column;
      background: rgba(5,6,9,0.88); color: #fff; font-family: system-ui, sans-serif; text-align: center; padding: 20px;
    }
    .wh-overlay h2 { font-size: clamp(26px, 5vw, 44px); margin-bottom: 12px; }
    .wh-overlay p { max-width: 560px; color: #cfd1d6; line-height: 1.6; font-size: 14px; margin-bottom: 26px; }
    .wh-overlay-buttons { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }

    .wh-attack-btn {
      display: none;
      position: fixed;
      right: 128px;
      bottom: 24px;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(122, 22, 32, 0.55);
      border: 2px solid rgba(255, 255, 255, 0.4);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      align-items: center;
      justify-content: center;
      user-select: none;
      z-index: 30;
    }
    .wh-attack-btn.active { background: rgba(255, 90, 90, 0.6); }

    .wh-waypoint {
      position: fixed;
      top: 54px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      color: #f4f4f4;
      font-family: system-ui, sans-serif;
      text-shadow: 0 1px 3px #000;
      pointer-events: none;
      z-index: 41;
    }
    .wh-waypoint-arrow {
      width: 0; height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 18px solid #37e0ff;
      filter: drop-shadow(0 0 6px rgba(55,224,255,0.7));
      transition: transform 0.1s linear;
    }
    .wh-waypoint-label { font-size: 12px; margin-top: 4px; background: rgba(10,12,18,0.55); padding: 3px 10px; border-radius: 6px; }

    .wh-suspicion-wrap {
      position: fixed;
      top: 14px;
      right: 16px;
      width: 200px;
      display: none;
      z-index: 41;
    }
    .wh-suspicion-label { color: #eee; font-size: 11px; margin-bottom: 4px; text-shadow: 0 1px 2px #000; text-align: right; }
    .wh-suspicion-bar-bg { width: 100%; height: 12px; border-radius: 6px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3); overflow: hidden; }
    .wh-suspicion-bar-fg { height: 100%; width: 0%; background: #4ade80; transition: width 0.15s, background 0.15s; }
    .wh-suspicion-wrap.alert .wh-suspicion-label { color: #ff6b6b; }
  `;
  document.head.appendChild(style);
}

export function createUI() {
  injectStyles();

  // --- Menu principal ---
  const menu = document.createElement('div');
  menu.className = 'wh-menu';
  menu.innerHTML = `
    <h1>WEB HERO</h1>
    <div class="wh-subtitle">Une nuit, un accident, un pouvoir. Choisis comment arpenter la ville.</div>
    <div class="wh-menu-buttons">
      <div class="wh-menu-btn" id="wh-btn-story">Mode Histoire
        <span class="wh-btn-desc">Enquête, infiltration, piratage et combats jusqu'au boss final</span>
      </div>
      <div class="wh-menu-btn" id="wh-btn-free">Mode Libre
        <span class="wh-btn-desc">Explore et swingue dans la ville, sans mission ni combat</span>
      </div>
    </div>
    <div class="wh-menu-hint">
      ZQSD/WASD : déplacement — Souris : regarder — Espace : sauter / lâcher la toile<br />
      Clic gauche : tirer une toile pour swinguer (s'enchaîne : re-clique en plein vol) — Clic droit / E : zip (tir-grappin direct)<br />
      Certaines missions se jouent sans combat : approche discrète et piratage de terminaux
    </div>
  `;
  document.body.appendChild(menu);

  // --- HUD général ---
  const hud = document.createElement('div');
  hud.className = 'wh-hud';
  hud.innerHTML = `
    <div class="wh-health-wrap" id="wh-health-wrap">
      <div class="wh-health-label">Santé</div>
      <div class="wh-health-bar-bg"><div class="wh-health-bar-fg" id="wh-health-fg"></div></div>
    </div>
    <div class="wh-objective" id="wh-objective"></div>
    <div class="wh-waypoint" id="wh-waypoint">
      <div class="wh-waypoint-arrow" id="wh-waypoint-arrow"></div>
      <div class="wh-waypoint-label" id="wh-waypoint-label"></div>
    </div>
    <div class="wh-suspicion-wrap" id="wh-suspicion-wrap">
      <div class="wh-suspicion-label" id="wh-suspicion-label">Suspicion</div>
      <div class="wh-suspicion-bar-bg"><div class="wh-suspicion-bar-fg" id="wh-suspicion-fg"></div></div>
    </div>
    <div class="wh-boss-wrap" id="wh-boss-wrap">
      <div class="wh-boss-name" id="wh-boss-name"></div>
      <div class="wh-boss-bar-bg"><div class="wh-boss-bar-fg" id="wh-boss-fg"></div></div>
    </div>
    <div class="wh-chapter-card" id="wh-chapter-card"></div>
    <div class="wh-dialogue" id="wh-dialogue">
      <span class="wh-skip" id="wh-dialogue-skip">Passer ▶</span>
      <div class="wh-speaker" id="wh-dialogue-speaker"></div>
      <div class="wh-line" id="wh-dialogue-line"></div>
    </div>
  `;
  document.body.appendChild(hud);

  const flash = document.createElement('div');
  flash.className = 'wh-flash';
  document.body.appendChild(flash);

  // --- Écrans de fin ---
  const gameOver = document.createElement('div');
  gameOver.className = 'wh-overlay';
  gameOver.innerHTML = `
    <h2>Tu es tombé...</h2>
    <p>La ville a besoin de toi debout. Reprends le combat là où tu l'as laissé.</p>
    <div class="wh-overlay-buttons"><div class="wh-menu-btn" id="wh-btn-retry">Réessayer</div></div>
  `;
  document.body.appendChild(gameOver);

  const victory = document.createElement('div');
  victory.className = 'wh-overlay';
  victory.innerHTML = `
    <h2 id="wh-victory-title">Épilogue</h2>
    <p id="wh-victory-text"></p>
    <div class="wh-overlay-buttons">
      <div class="wh-menu-btn" id="wh-btn-freeroam">Explorer librement</div>
      <div class="wh-menu-btn" id="wh-btn-menu">Menu principal</div>
    </div>
  `;
  document.body.appendChild(victory);

  const attackBtn = document.createElement('div');
  attackBtn.className = 'wh-attack-btn';
  attackBtn.textContent = 'FRAPPER';
  document.body.appendChild(attackBtn);

  const el = {
    menu,
    healthWrap: document.getElementById('wh-health-wrap'),
    healthFg: document.getElementById('wh-health-fg'),
    objective: document.getElementById('wh-objective'),
    waypoint: document.getElementById('wh-waypoint'),
    waypointArrow: document.getElementById('wh-waypoint-arrow'),
    waypointLabel: document.getElementById('wh-waypoint-label'),
    suspicionWrap: document.getElementById('wh-suspicion-wrap'),
    suspicionFg: document.getElementById('wh-suspicion-fg'),
    bossWrap: document.getElementById('wh-boss-wrap'),
    bossName: document.getElementById('wh-boss-name'),
    bossFg: document.getElementById('wh-boss-fg'),
    chapterCard: document.getElementById('wh-chapter-card'),
    dialogue: document.getElementById('wh-dialogue'),
    dialogueSkip: document.getElementById('wh-dialogue-skip'),
    dialogueSpeaker: document.getElementById('wh-dialogue-speaker'),
    dialogueLine: document.getElementById('wh-dialogue-line'),
    flash,
    gameOver,
    retryBtn: document.getElementById('wh-btn-retry'),
    victory,
    victoryTitle: document.getElementById('wh-victory-title'),
    victoryText: document.getElementById('wh-victory-text'),
    freeroamBtn: document.getElementById('wh-btn-freeroam'),
    menuBtn: document.getElementById('wh-btn-menu'),
    attackBtn,
    storyBtn: document.getElementById('wh-btn-story'),
    freeBtn: document.getElementById('wh-btn-free'),
  };

  let chapterCardTimer = null;
  let flashTimer = null;

  return {
    el,
    hideMenu() { menu.style.display = 'none'; },
    showMenu() { menu.style.display = 'flex'; },

    showStoryHud() { el.healthWrap.style.display = 'block'; },
    hideStoryHud() {
      el.healthWrap.style.display = 'none';
      el.objective.style.display = 'none';
      el.bossWrap.style.display = 'none';
      el.waypoint.style.display = 'none';
      el.suspicionWrap.style.display = 'none';
    },

    // Compas de quête : pointe vers targetPos en fonction de l'orientation
    // de la caméra, et affiche la distance restante. Appelé chaque frame
    // par missionManager pendant les étapes de voyage/infiltration.
    showWaypoint(camera, targetPos, label) {
      const THREE_Y_AXIS = { x: 0, y: 1, z: 0 };
      const toTarget = { x: targetPos.x - camera.position.x, z: targetPos.z - camera.position.z };
      const dist = Math.hypot(toTarget.x, toTarget.z);
      const targetYaw = Math.atan2(toTarget.x, toTarget.z);

      const forward = { x: 0, z: -1 };
      // Récupère le lacet (yaw) de la caméra depuis son quaternion
      const q = camera.quaternion;
      const cameraYaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));

      let rel = targetYaw - (cameraYaw + Math.PI);
      rel = ((rel + Math.PI) % (Math.PI * 2)) - Math.PI;

      el.waypointArrow.style.transform = `rotate(${rel}rad)`;
      el.waypointLabel.textContent = `${label} — ${Math.round(dist)} m`;
      el.waypoint.style.display = 'flex';
    },
    hideWaypoint() { el.waypoint.style.display = 'none'; },

    showSuspicion() { el.suspicionWrap.style.display = 'block'; },
    hideSuspicion() { el.suspicionWrap.style.display = 'none'; },
    updateSuspicion(value, max) {
      const pct = Math.max(0, Math.min(100, (value / max) * 100));
      el.suspicionFg.style.width = pct + '%';
      el.suspicionFg.style.background = pct > 75 ? '#ff4d4d' : pct > 40 ? '#f5a623' : '#4ade80';
      el.suspicionWrap.classList.toggle('alert', pct > 75);
    },

    updateHealth(hp, maxHp) {
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      el.healthFg.style.width = pct + '%';
      el.healthFg.style.background = pct > 50 ? '#4ade80' : pct > 20 ? '#f5a623' : '#ff4d4d';
    },

    flashDamage() {
      el.flash.classList.add('on');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => el.flash.classList.remove('on'), 160);
    },

    showObjective(text) {
      el.objective.textContent = text;
      el.objective.style.display = 'block';
    },
    hideObjective() { el.objective.style.display = 'none'; },

    showChapterCard(title) {
      el.chapterCard.textContent = title;
      el.chapterCard.classList.add('show');
      clearTimeout(chapterCardTimer);
      return new Promise((resolve) => {
        chapterCardTimer = setTimeout(() => {
          el.chapterCard.classList.remove('show');
          setTimeout(resolve, 950);
        }, 2600);
      });
    },

    showDialogue(speaker, text) {
      el.dialogueSpeaker.textContent = speaker || '';
      el.dialogueLine.textContent = text || '';
      el.dialogue.style.display = 'block';
    },
    hideDialogue() { el.dialogue.style.display = 'none'; },

    showBossBar(name) {
      el.bossName.textContent = name;
      el.bossFg.style.width = '100%';
      el.bossWrap.style.display = 'block';
    },
    updateBossBar(hp, maxHp) {
      el.bossFg.style.width = Math.max(0, (hp / maxHp) * 100) + '%';
    },
    hideBossBar() { el.bossWrap.style.display = 'none'; },

    showGameOver() { el.gameOver.style.display = 'flex'; },
    hideGameOver() { el.gameOver.style.display = 'none'; },

    showVictory(title, text) {
      el.victoryTitle.textContent = title;
      el.victoryText.textContent = text;
      el.victory.style.display = 'flex';
    },
    hideVictory() { el.victory.style.display = 'none'; },

    showAttackButton() { el.attackBtn.style.display = 'flex'; },
    hideAttackButton() { el.attackBtn.style.display = 'none'; },
  };
}
