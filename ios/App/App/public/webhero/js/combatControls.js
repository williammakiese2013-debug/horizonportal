// combatControls.js
// Relie le flux de hand tracking (handTracking.js) aux commandes du joueur
// (player.js) — c'est ici que TOUTES les commandes du Mode Cardboard sont
// mappées sur des gestes, pour jouer mains libres dans le viewer :
//   - index seul tendu, pointé vers l'avant -> avance en continu (+ virage
//                                               gauche/droite selon la position
//                                               horizontale de la main)
//   - main ouverte levée rapidement vers le haut -> saut (vélocité verticale
//                                               réelle du poignet, voir plus bas)
//   - signe "Spider-Man" (index + auriculaire tendus) OU pinch (index-pouce)
//                              -> shootWeb() / releaseWeb() (tir de toile)
//   - main ouverte + mouvement -> vecteur de swing analogique (setMoveVector),
//                                  utilisé pendant qu'on est accroché en l'air
//   - poing fermé              -> entrée en Mode Combat
//   - relâchement du poing     -> attack(power), power dérivé de la vitesse
//                                  RÉELLE du poignet pendant le geste (pic de
//                                  vélocité observé pendant que le poing est
//                                  fermé, avant relâchement).
//
// Le calcul de puissance est strictement basé sur la cinématique mesurée :
// plus le poing va vite, plus le power (et donc dégâts + recul, voir
// missionManager.js / enemies.js) est élevé. Aucune valeur n'est inventée :
// tout part de handState.velocity.speed fourni par handTracking.js.
//
// Le tap/toucher virtuel (utilisé pour le mini-jeu de hacking et les menus)
// est géré séparément, voir handPointer.js — il fonctionne indépendamment du
// Mode Combat pour rester utilisable à tout moment en Mode Cardboard.

import { CONFIG } from './config.js';
import { getHandState } from './handTracking.js';

export function createHandCombatMapper(player) {
  let combatMode = false;   // true dès que le poing se ferme
  let peakSpeed = 0;        // pic de vitesse observé pendant le poing fermé
  let wasPinching = false;
  let wasSpiderSign = false;
  let wasFist = false;
  let pinchCooldown = 0;
  let spiderCooldown = 0;
  let jumpCooldown = 0;

  function reset() {
    combatMode = false;
    peakSpeed = 0;
  }

  function update(delta) {
    const hs = getHandState();
    if (pinchCooldown > 0) pinchCooldown -= delta;
    if (spiderCooldown > 0) spiderCooldown -= delta;
    if (jumpCooldown > 0) jumpCooldown -= delta;

    if (!hs.visible) {
      // Main perdue par le tracker en plein Mode Combat : on annule le
      // combo en cours plutôt que de déclencher un coup sur une vélocité
      // périmée.
      if (combatMode) reset();
      wasPinching = false;
      wasSpiderSign = false;
      wasFist = false;
      return;
    }

    // --- Pinch OU signe Spider-Man : tir de toile (front montant, anti-rebond) ---
    if (hs.pinching && !wasPinching && pinchCooldown <= 0) {
      player.shootWeb();
      pinchCooldown = CONFIG.HAND.PINCH_DEBOUNCE;
    } else if (!hs.pinching && wasPinching) {
      player.releaseWeb();
    }
    wasPinching = hs.pinching;

    if (hs.spiderSign && !wasSpiderSign && spiderCooldown <= 0) {
      player.shootWeb();
      spiderCooldown = CONFIG.HAND.SPIDER_SIGN_DEBOUNCE;
    } else if (!hs.spiderSign && wasSpiderSign) {
      player.releaseWeb();
    }
    wasSpiderSign = hs.spiderSign;

    // --- Index seul tendu, pointé vers l'avant : avance en continu ---
    // Le virage gauche/droite suit la position horizontale de la main par
    // rapport au centre de l'image caméra (même logique que le pilotage à
    // main ouverte ci-dessous, mais avec z fixé en avant).
    if (hs.pointing && hs.landmarks) {
      const wristX = hs.landmarks[0].x;
      const steerX = Math.max(-1, Math.min(1, (wristX - 0.5) * CONFIG.HAND.POINT_STEER_SENSITIVITY));
      player.setMoveVector(steerX, CONFIG.HAND.POINT_FORWARD_SPEED);
    } else if (hs.openPalm && hs.landmarks) {
      // --- Main ouverte : pilotage analogique pendant le swing (steering) ---
      // On centre sur le milieu de l'image (0.5) pour retrouver un vecteur -1..1.
      const wristX = hs.landmarks[0].x;
      const wristY = hs.landmarks[0].y;
      const steerX = Math.max(-1, Math.min(1, (wristX - 0.5) * 3));
      const steerZ = Math.max(-1, Math.min(1, (0.5 - wristY) * 3));
      player.setMoveVector(steerX, steerZ);
    } else {
      // Ni "avancer" ni "piloter" : on arrête le déplacement analogique
      // plutôt que de laisser le joueur continuer sur la dernière valeur.
      player.setMoveVector(0, 0);
    }

    // --- Main ouverte levée rapidement vers le haut : saut ---
    // hs.velocity.y est déjà en unités de jeu/s et déjà orienté "vers le
    // haut = positif" (voir handTracking.js). On ne déclenche que sur un
    // vrai pic (front montant au-delà du seuil), pas en continu.
    if (hs.openPalm && hs.velocity.y > CONFIG.HAND.JUMP_VELOCITY_THRESHOLD && jumpCooldown <= 0) {
      player.jump();
      jumpCooldown = CONFIG.HAND.JUMP_DEBOUNCE;
    }

    // --- Poing fermé : Mode Combat, on traque le pic de vitesse ---
    if (hs.fist) {
      if (!wasFist) {
        // Début d'un nouveau coup : on repart d'un pic propre.
        combatMode = true;
        peakSpeed = hs.velocity.speed;
      } else {
        peakSpeed = Math.max(peakSpeed, hs.velocity.speed);
      }
    } else if (wasFist && combatMode) {
      // Relâchement du poing après un Mode Combat actif = le coup part.
      // power scale linéairement avec le pic de vitesse mesuré, ramené à
      // PUNCH_REFERENCE_SPEED = power 1, puis clampé aux bornes configurées.
      const c = CONFIG.COMBAT;
      const rawPower = peakSpeed / c.PUNCH_REFERENCE_SPEED;
      const power = Math.max(c.PUNCH_MIN_POWER, Math.min(c.PUNCH_MAX_POWER, rawPower));
      player.attack(power);
      reset();
    }
    wasFist = hs.fist;
  }

  return {
    update,
    isInCombatMode: () => combatMode,
    getPeakSpeed: () => peakSpeed,
  };
}
