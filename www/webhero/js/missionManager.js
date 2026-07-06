// missionManager.js
// Orchestre le Mode Histoire : déroule les chapitres de story.js dans l'ordre,
// joue les narrations (via narrator.js), fait apparaître les vagues d'ennemis
// (via enemies.js) autour du joueur, gère le combat (attaque du joueur,
// dégâts reçus, mort/retour au dernier point de contrôle) et pilote le HUD
// (via ui.js). Gère aussi les quêtes non-combat : voyage vers un lieu
// (compas de quête), infiltration (jauge de suspicion + caméras de poi.js,
// avec des gardes qui interviennent en cas d'alarme) et piratage de
// terminaux (mini-jeu de hacking.js).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { STORY, EPILOGUE_TITLE, EPILOGUE_TEXT } from './story.js';
import { createEnemy } from './enemies.js';

export function createMissionManager({ scene, buildingBoxes, camera, player, ui, narrator, poi, hacking }) {
  const activeEnemies = [];
  const frameHooks = new Set();

  let checkpointPos = camera.position.clone();
  let currentBoss = null;
  let pendingDeathResolve = null;
  let stepGeneration = 0;

  function collidesPoint(x, z) {
    for (const box of buildingBoxes) {
      if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) return true;
    }
    return false;
  }

  function pickSpawnPoint(center, minR, maxR) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = center.x + Math.cos(angle) * r;
      const z = center.z + Math.sin(angle) * r;
      if (!collidesPoint(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(center.x + minR, 0, center.z);
  }

  function cleanupActiveEnemies() {
    for (const e of activeEnemies) e.forceRemove();
    activeEnemies.length = 0;
    currentBoss = null;
    ui.hideBossBar();
    ui.hideObjective();
    ui.hideWaypoint();
    ui.hideSuspicion();
    if (poi) poi.endWatch();
  }

  // power (défaut 1) vient de player.attack(power) : 1 = coup clavier normal,
  // >1 = coup à mains nues plus rapide (hand tracking), scale dynamiquement
  // les dégâts ET la force de recul de l'ennemi touché.
  function handlePlayerAttack(pos, dir, power = 1) {
    const flatDir = dir.clone();
    flatDir.y = 0;
    flatDir.normalize();
    const damage = CONFIG.COMBAT.ATTACK_DAMAGE * power;
    const knockbackForce = CONFIG.COMBAT.PUNCH_KNOCKBACK_BASE * power;
    for (const enemy of activeEnemies) {
      if (enemy.isDead()) continue;
      const epos = enemy.getPosition();
      const toEnemy = new THREE.Vector3().subVectors(epos, pos);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist > CONFIG.COMBAT.ATTACK_RANGE + enemy.def.radius) continue;
      toEnemy.normalize();
      const angle = flatDir.angleTo(toEnemy);
      if (angle <= CONFIG.COMBAT.ATTACK_ANGLE) {
        enemy.takeDamage(damage);
        enemy.applyKnockback(toEnemy, knockbackForce);
      }
    }
  }

  function makeEnemyOptions(onDeath) {
    return {
      getPlayerPosition: () => camera.position,
      onHitPlayer: (dmg) => {
        player.takeDamage(dmg);
        ui.flashDamage();
      },
      onDeath: onDeath || (() => {}),
      buildingBoxes,
      camera,
    };
  }

  function runNarration(lines) {
    return new Promise((resolve) => {
      const skipSignal = { skipped: false };
      const onSkip = () => {
        skipSignal.skipped = true;
        narrator.stop();
      };
      ui.el.dialogueSkip.addEventListener('click', onSkip);
      ui.el.dialogue.addEventListener('click', onSkip);

      (async () => {
        for (const line of lines) {
          if (skipSignal.skipped) break;
          ui.showDialogue(line.speaker, line.text);
          await narrator.speak(line.text, skipSignal);
        }
        ui.el.dialogueSkip.removeEventListener('click', onSkip);
        ui.el.dialogue.removeEventListener('click', onSkip);
        ui.hideDialogue();
        resolve();
      })();
    });
  }

  function runTutorial(step) {
    return new Promise((resolve) => {
      ui.showObjective(step.text);
      let traveled = 0;
      let elapsed = 0;
      let swungOnce = false;
      const lastPos = camera.position.clone();

      const hook = (delta) => {
        elapsed += delta;
        traveled += camera.position.distanceTo(lastPos);
        lastPos.copy(camera.position);
        if (player.isSwinging()) swungOnce = true;
        if ((traveled >= step.minDistance && swungOnce) || elapsed > 45) {
          frameHooks.delete(hook);
          ui.hideObjective();
          resolve();
        }
      };
      frameHooks.add(hook);
    });
  }

  function waitForWaveCleared(waveEnemies) {
    return new Promise((resolve) => {
      const hook = () => {
        if (waveEnemies.every((e) => e.isDead())) {
          frameHooks.delete(hook);
          resolve();
        }
      };
      frameHooks.add(hook);
    });
  }

  function runCombat(step, gen) {
    return new Promise((resolve) => {
      const totalCount = step.waves.reduce((s, w) => s + w.count, 0);
      let killed = 0;
      ui.showObjective(`${step.text} (0/${totalCount})`);

      (async () => {
        for (const wave of step.waves) {
          if (gen !== stepGeneration) return resolve();
          const waveEnemies = [];
          for (let i = 0; i < wave.count; i++) {
            const pos = pickSpawnPoint(checkpointPos, CONFIG.COMBAT.SPAWN_MIN_RADIUS, CONFIG.COMBAT.SPAWN_MAX_RADIUS);
            const enemy = createEnemy(scene, wave.type, pos, makeEnemyOptions(() => {
              killed++;
              ui.showObjective(`${step.text} (${killed}/${totalCount})`);
            }));
            activeEnemies.push(enemy);
            waveEnemies.push(enemy);
          }
          await waitForWaveCleared(waveEnemies);
        }
        ui.hideObjective();
        resolve();
      })();
    });
  }

  // --- Étape "voyage" : rejoindre un lieu (compas de quête), sans combat ---
  function runTravel(step) {
    return new Promise((resolve) => {
      const target = poi.pois[step.poiKey].position;
      const radius = step.radius || 10;
      ui.showObjective(step.text);
      ui.showWaypoint(camera, target, step.label || poi.pois[step.poiKey].name);

      const hook = () => {
        ui.showWaypoint(camera, target, step.label || poi.pois[step.poiKey].name);
        const dist = Math.hypot(camera.position.x - target.x, camera.position.z - target.z);
        if (dist <= radius) {
          frameHooks.delete(hook);
          ui.hideObjective();
          ui.hideWaypoint();
          resolve();
        }
      };
      frameHooks.add(hook);
    });
  }

  // --- Étape "infiltration" : approcher discrètement un lieu surveillé par
  // des caméras. Rester trop longtemps dans leur cône fait monter la
  // suspicion ; à fond, une alarme déclenche une vague de gardes à
  // neutraliser avant de pouvoir continuer tranquillement. ---
  function runInfiltration(step, gen) {
    return new Promise((resolve) => {
      const target = poi.pois[step.poiKey];
      const consoleRadius = step.consoleRadius || 4;
      ui.showObjective(step.text);
      ui.showSuspicion();
      poi.beginWatch(step.poiKey);

      let handlingAlarm = false;

      const hook = (delta) => {
        if (gen !== stepGeneration) {
          frameHooks.delete(hook);
          poi.endWatch();
          return;
        }
        if (handlingAlarm) return;
        ui.showWaypoint(camera, target.consoleWorldPos, target.name);
        const { suspicion, alarm } = poi.update(delta, camera.position);
        ui.updateSuspicion(suspicion, CONFIG.SUSPICION_MAX);

        if (alarm) {
          handlingAlarm = true;
          ui.showObjective('Alarme déclenchée : neutralise les gardes !');
          const waveEnemies = [];
          const count = step.alarmWave || 3;
          for (let i = 0; i < count; i++) {
            const pos = pickSpawnPoint(target.position, 8, 16);
            const enemy = createEnemy(scene, 'grunt', pos, makeEnemyOptions());
            activeEnemies.push(enemy);
            waveEnemies.push(enemy);
          }
          waitForWaveCleared(waveEnemies).then(() => {
            if (gen !== stepGeneration) return;
            poi.beginWatch(step.poiKey); // remise à zéro de la suspicion
            ui.showObjective(step.text);
            handlingAlarm = false;
          });
          return;
        }

        const dist = camera.position.distanceTo(target.consoleWorldPos);
        if (dist <= consoleRadius) {
          frameHooks.delete(hook);
          poi.endWatch();
          ui.hideObjective();
          ui.hideWaypoint();
          ui.hideSuspicion();
          resolve();
        }
      };
      frameHooks.add(hook);
    });
  }

  // --- Étape "piratage" : mini-jeu de terminal. Un échec ne bloque pas la
  // progression : ça alerte simplement des gardes qu'il faut gérer avant de
  // retenter le piratage. ---
  function runHacking(step, gen) {
    return new Promise((resolve) => {
      ui.showObjective(step.text);

      const attempt = () => {
        hacking.start((success) => {
          if (gen !== stepGeneration) return;
          if (success) {
            ui.hideObjective();
            resolve();
            return;
          }
          ui.showObjective('Intrusion repérée : neutralise la sécurité, puis retente le piratage.');
          const waveEnemies = [];
          const spawnCenter = step.poiKey ? poi.pois[step.poiKey].position : camera.position;
          for (let i = 0; i < (step.failWave || 2); i++) {
            const pos = pickSpawnPoint(spawnCenter, 8, 16);
            const enemy = createEnemy(scene, 'grunt', pos, makeEnemyOptions());
            activeEnemies.push(enemy);
            waveEnemies.push(enemy);
          }
          waitForWaveCleared(waveEnemies).then(() => {
            if (gen !== stepGeneration) return;
            ui.showObjective(step.text);
            attempt();
          });
        });
      };
      attempt();
    });
  }

  function runBoss(step) {
    return new Promise((resolve) => {
      ui.showObjective(step.text);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      dir.y = 0;
      dir.normalize();
      let pos = checkpointPos.clone().addScaledVector(dir, CONFIG.COMBAT.BOSS_SPAWN_DISTANCE);
      if (collidesPoint(pos.x, pos.z)) {
        pos = pickSpawnPoint(checkpointPos, CONFIG.COMBAT.BOSS_SPAWN_DISTANCE - 4, CONFIG.COMBAT.BOSS_SPAWN_DISTANCE + 8);
      }
      const boss = createEnemy(scene, step.enemyType, pos, makeEnemyOptions());
      activeEnemies.push(boss);
      currentBoss = boss;
      ui.showBossBar(boss.getName());

      const hook = () => {
        if (currentBoss) ui.updateBossBar(currentBoss.getHealth(), currentBoss.getMaxHealth());
        if (boss.isDead()) {
          frameHooks.delete(hook);
          currentBoss = null;
          ui.hideBossBar();
          ui.hideObjective();
          resolve();
        }
      };
      frameHooks.add(hook);
    });
  }

  function runStep(step, gen) {
    switch (step.type) {
      case 'narration':
        return runNarration(step.lines);
      case 'tutorial':
        return runTutorial(step);
      case 'combat':
        return runCombat(step, gen);
      case 'travel':
        return runTravel(step);
      case 'infiltration':
        return runInfiltration(step, gen);
      case 'hacking':
        return runHacking(step, gen);
      case 'boss':
        return runBoss(step);
      default:
        return Promise.resolve();
    }
  }

  async function runStepGuarded(step) {
    for (;;) {
      const myGen = ++stepGeneration;
      checkpointPos = camera.position.clone();

      const deathPromise = new Promise((resolve) => {
        pendingDeathResolve = () => resolve('died');
      });
      const stepPromise = runStep(step, myGen).then(() => 'done');

      const winner = await Promise.race([stepPromise, deathPromise]);
      if (winner === 'done') {
        pendingDeathResolve = null;
        return;
      }
      // Le joueur est mort : on nettoie et on relance la même étape.
    }
  }

  function onRetryClick() {
    ui.hideGameOver();
    cleanupActiveEnemies();
    player.respawn(checkpointPos);
    if (pendingDeathResolve) {
      const resolve = pendingDeathResolve;
      pendingDeathResolve = null;
      resolve();
    }
  }

  async function start() {
    player.setOnDamage((hp, max) => ui.updateHealth(hp, max));
    player.setOnDeath(() => ui.showGameOver());
    player.setOnAttack((pos, dir, power) => handlePlayerAttack(pos, dir, power));
    ui.el.retryBtn.addEventListener('click', onRetryClick);

    ui.showStoryHud();
    ui.updateHealth(player.getHealth(), player.getMaxHealth());

    for (const chapter of STORY) {
      await ui.showChapterCard(chapter.title);
      for (const step of chapter.steps) {
        await runStepGuarded(step);
      }
    }

    ui.hideStoryHud();
    cleanupActiveEnemies();
    ui.showVictory(EPILOGUE_TITLE, EPILOGUE_TEXT);
  }

  function update(delta) {
    for (let i = activeEnemies.length - 1; i >= 0; i--) {
      if (activeEnemies[i].isRemovable()) activeEnemies.splice(i, 1);
    }
    for (const e of activeEnemies) e.update(delta);
    for (const hook of Array.from(frameHooks)) hook(delta);
  }

  return { start, update };
}
