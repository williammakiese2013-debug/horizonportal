// config.js
// Paramètres globaux pour la génération de la ville et du monde du jeu.
// Étape 1/N : on centralise ici toutes les constantes pour pouvoir
// ajuster facilement la taille de la ville sans toucher au reste du code.

export const CONFIG = {
  // Taille de la grille de la ville (nombre de blocs en X et Z)
  CITY_BLOCKS_X: 10,
  CITY_BLOCKS_Z: 10,

  // Taille d'un "bloc" (pâté de maisons) en unités 3D
  BLOCK_SIZE: 60,

  // Largeur des rues entre les blocs
  STREET_WIDTH: 14,

  // Hauteur min / max des immeubles (pour varier la skyline)
  BUILDING_MIN_HEIGHT: 20,
  BUILDING_MAX_HEIGHT: 180,

  // Emprise au sol min / max d'un immeuble à l'intérieur d'un bloc
  BUILDING_MIN_FOOTPRINT: 18,
  BUILDING_MAX_FOOTPRINT: 40,

  // Nombre d'immeubles générés par bloc (grappe façon Manhattan)
  BUILDINGS_PER_BLOCK_MIN: 1,
  BUILDINGS_PER_BLOCK_MAX: 3,

  // Couleurs de base (façon nuit / béton / verre)
  BUILDING_COLORS: [
    0x2b2f36, // béton foncé
    0x3a3f47,
    0x4a4e57,
    0x1f2937, // bleu-gris verre
    0x374151,
  ],

  // Fenêtres allumées (émissif)
  WINDOW_LIGHT_COLOR: 0xffe08a,

  // Distance de brouillard pour donner de la profondeur réaliste
  FOG_NEAR: 200,
  FOG_FAR: 1400,
  FOG_COLOR: 0x0b0e14,

  // Ciel / ambiance (on part sur une ambiance nocturne, plus "réaliste" visuellement
  // pour un jeu de super-héros urbain, et ça cache moins bien les limites de la ville)
  SKY_COLOR: 0x0b0e14,

  // Vitesse de déplacement de la caméra de test (avant d'avoir le héros)
  CAMERA_SPEED: 1.2,

  // --- Joueur en vue première personne ---
  PLAYER_HEIGHT: 1.8,
  PLAYER_RADIUS: 0.4,
  PLAYER_SPEED: 22, // unités / seconde
  PLAYER_RUN_MULTIPLIER: 1.8,

  // --- Rues / trottoirs ---
  ROAD_COLOR: 0x1c1c1e,
  SIDEWALK_COLOR: 0x5a5a5f,
  SIDEWALK_HEIGHT: 0.25,
  SIDEWALK_WIDTH: 2.5,
  LANE_MARK_COLOR: 0xdddddd,

  // --- Voitures animées ---
  CAR_COUNT: 24,
  CAR_SPEED_MIN: 8,
  CAR_SPEED_MAX: 16,
  CAR_COLORS: [0xb0201c, 0xd4d4d4, 0x1c2b4a, 0xe8b923, 0x2a2a2a, 0x8a1f1f],

  // --- Physique / toile ---
  GRAVITY: 28,
  JUMP_SPEED: 11,
  WEB_MAX_DISTANCE: 140,
  WEB_MIN_ANCHOR_HEIGHT_ABOVE: 3, // le point d'accroche doit être au-dessus du joueur d'au moins ça
  WEB_COLOR: 0xf4f4f4,

  // --- Contrôles mobiles ---
  MOBILE_LOOK_SENSITIVITY: 0.0028,
  MOBILE_JOYSTICK_RADIUS: 50,

  // --- Rendu visuel de la toile ---
  WEB_STRAND_COUNT: 3,
  WEB_STRAND_SEGMENTS: 22,
  WEB_SAG_FACTOR: 0.1,        // affaissement proportionnel à la longueur
  WEB_MAX_SAG: 5,
  WEB_STRAND_SAG_MULT: [1, 0.55, 1.35],   // chaque brin s'affaisse différemment
  WEB_STRAND_LATERAL_AMPL: [0, 0.45, -0.4], // écartement latéral de chaque brin
  WEB_STRAND_LATERAL_FREQ: [1, 2, 3],       // ondulation le long du brin
  WEB_RUNG_COUNT: 7,          // petits fils qui relient les brins entre eux
  WEB_SPLAT_LIFETIME: 3.2,    // durée de l'impact en étoile sur l'immeuble
  WEB_SPLAT_SPOKES: 9,
  WEB_SPLAT_RADIUS: 1.1,
  WEB_SHOT_DURATION: 0.1,     // durée visuelle du "jet" de toile au tir
  WEB_SHOT_PARTICLES: 12,

  // Particules qui longent la toile pendant tout le swing, pour plus de réalisme
  WEB_SWING_PARTICLE_COUNT: 24,
  WEB_SWING_PARTICLE_JITTER: 0.12,
  WEB_SWING_PARTICLE_SIZE: 0.05,

  // --- Swing "vol araignée" : tension du fil pilotable, virage en l'air, boost ---
  WEB_ROPE_MIN: 4,           // longueur mini du fil (on ne peut pas s'enrouler à l'infini)
  WEB_REEL_SPEED: 26,        // vitesse à laquelle on raccourcit/rallonge le fil (avant/arrière)
  WEB_SWING_AIR_ACCEL: 46,   // poussée latérale pendant le swing (contrôle en l'air)
  WEB_SWING_FORWARD_ACCEL: 30, // poussée tangentielle avant/arrière pendant le swing
  WEB_RELEASE_BOOST: 1.22,   // multiplicateur de vitesse au lâcher de la toile (élan)
  WEB_MAX_SPEED: 70,         // vitesse plafond pendant le swing pour rester jouable

  // --- Rendu visuel des fenêtres/panneaux (nuit) ---
  WINDOW_EMISSIVE_COLOR: 0xffe08a,
  WINDOW_EMISSIVE_MAX: 2.4,   // intensité émissive des fenêtres en pleine nuit

  // --- Enseignes lumineuses / panneaux publicitaires sur les gratte-ciels ---
  BILLBOARD_COUNT: 26,
  BILLBOARD_MIN_HEIGHT: 45,     // seulement sur des immeubles assez hauts
  BILLBOARD_COLORS: [0xff3b6e, 0x37e0ff, 0xffe14d, 0x7dff6b, 0xb46bff, 0xff8a3d],
  BILLBOARD_EMISSIVE_MIN: 0.5,  // toujours un peu allumé (écrans autonomes)
  BILLBOARD_EMISSIVE_MAX: 3.2,
  BILLBOARD_LIGHT_RANGE: 55,
  BILLBOARD_LIGHT_INTENSITY: 6,

  // --- Balises rouges au sommet des tours les plus hautes (aviation) ---
  ROOFTOP_BEACON_MIN_HEIGHT: 140,
  ROOFTOP_BEACON_COLOR: 0xff2020,
  ROOFTOP_BEACON_BLINK_SPEED: 2.4,

  // --- Lampadaires de rue (glow + pool de vraies lumières près du joueur) ---
  STREETLAMP_SPACING: 26,       // distance entre deux lampadaires le long d'une rue
  STREETLAMP_HEIGHT: 7.5,
  STREETLAMP_COLOR: 0xffcf8a,
  STREETLAMP_EMISSIVE_MAX: 3,
  STREETLAMP_LIGHT_POOL_SIZE: 22, // nombre de vraies lumières réutilisées près de la caméra
  STREETLAMP_LIGHT_RANGE: 24,
  STREETLAMP_LIGHT_INTENSITY: 6,


  // --- Cycle jour / nuit ---
  DAY_CYCLE_SECONDS: 240,   // durée d'un cycle complet (jour+nuit) en secondes
  DAY_START_T: 0.62,        // on démarre juste après le coucher de soleil pour voir vite le résultat
  SUN_ORBIT_RADIUS: 900,    // distance du disque soleil/lune dans le ciel

  // --- Flaques d'eau réfléchissantes au sol ---
  PUDDLE_COUNT: 16,
  PUDDLE_MIN_RADIUS: 1.6,
  PUDDLE_MAX_RADIUS: 4.2,
  PUDDLE_TEXTURE_SIZE: 256,

  // --- Assistance de visée pour la toile (fiabilité du swing) ---
  WEB_AIM_ASSIST_CONE: 0.30,     // demi-angle (radians) du cône de rattrapage si le tir direct rate
  WEB_AIM_ASSIST_RINGS: 4,       // nombre d'anneaux de rayons testés dans le cône
  WEB_AIM_ASSIST_PER_RING: 8,    // nombre de rayons testés par anneau

  // --- Zip : tir-grappin qui "tire" directement le joueur vers un point (sans pendule) ---
  ZIP_MAX_DISTANCE: 100,
  ZIP_MIN_DISTANCE: 5,
  ZIP_SPEED: 62,
  ZIP_ARRIVE_RADIUS: 2.4,
  ZIP_END_BOOST: 1.1,
  ZIP_COOLDOWN: 0.15,

  // --- Enchaînement toile/zip façon "vol" : ré-accrochage quasi instantané ---
  WEB_CHAIN_GRACE: 0.12,

  // --- Infiltration / Piratage (nouvelles quêtes non-combat) ---
  SUSPICION_MAX: 100,
  SUSPICION_RISE_PER_SEC: 42,
  SUSPICION_FALL_PER_SEC: 16,
  CAMERA_RANGE: 30,
  CAMERA_HALF_FOV: 0.5,          // radians
  CAMERA_SWEEP_ARC: 0.85,        // radians, amplitude du balayage
  CAMERA_SWEEP_SPEED: 0.55,      // vitesse angulaire du balayage

  HACK_NODE_COUNT: 4,
  HACK_TIME_PER_NODE: 6,
  HACK_MAX_MISSES: 3,

  // --- Combat (Mode Histoire) ---
  COMBAT: {
    PLAYER_MAX_HEALTH: 100,
    PLAYER_INVULN_TIME: 0.5,
    ATTACK_RANGE: 3.4,
    ATTACK_ANGLE: 0.65, // demi-angle du cône de coup (radians)
    ATTACK_DAMAGE: 25,
    ATTACK_COOLDOWN: 0.45,
    SPAWN_MIN_RADIUS: 16,
    SPAWN_MAX_RADIUS: 32,
    BOSS_SPAWN_DISTANCE: 22,

    // --- Coup de poing à mains nues (velocity-based, hand tracking) ---
    // Le multiplicateur de puissance ("power") est calculé à partir de la
    // vitesse réelle du poignet/poing pendant le geste et vient MULTIPLIER
    // ATTACK_DAMAGE + la force de recul ci-dessous. power = 1 correspond au
    // coup clavier (touche F) déjà existant.
    PUNCH_MIN_POWER: 0.4,        // coup "mou" (main presque immobile)
    PUNCH_MAX_POWER: 3.2,        // coup max (poing lancé très vite)
    PUNCH_REFERENCE_SPEED: 2.4,  // vitesse (u/s, espace normalisé remis à l'échelle) qui donne power = 1
    PUNCH_KNOCKBACK_BASE: 6,     // force de recul de base appliquée à l'ennemi (unités/s d'impulsion)
    PUNCH_KNOCKBACK_DECAY: 6,    // atténuation de l'impulsion de recul (par seconde)
  },

  // --- Hand tracking (MediaPipe, caméra arrière) ---
  HAND: {
    // Caméra ARRIÈRE : nécessaire car le téléphone est logé dans le
    // visualisateur Cardboard, écran contre le visage — la caméra frontale
    // ne peut plus voir les mains. La caméra arrière regarde vers l'avant
    // depuis le front du joueur et peut voir les mains levées devant lui.
    FACING_MODE: 'environment',
    VIDEO_WIDTH: 640,
    VIDEO_HEIGHT: 480,
    // Fenêtre de lissage de la vélocité (secondes) : on moyenne sur cette
    // durée glissante pour ne pas laisser le bruit du tracker créer de faux
    // pics de vitesse.
    VELOCITY_SMOOTHING_WINDOW: 0.09,
    // Facteur de mise à l'échelle : MediaPipe donne des coordonnées
    // normalisées (0..1 dans l'image), pas des mètres réels. On convertit
    // grossièrement en "unités de jeu par seconde" avec ce facteur (calibré
    // empiriquement — ajuster si les coups semblent trop faibles/trop forts).
    VELOCITY_SCALE: 9,
    PINCH_DEBOUNCE: 0.18, // anti-rebond entre deux pinchs (tir de toile)
    SPIDER_SIGN_DEBOUNCE: 0.18, // anti-rebond du signe Spider-Man (tir de toile)

    // --- Avancer en pointant l'index vers l'avant ---
    // Vitesse d'avance appliquée (même échelle que le joystick tactile,
    // -1..1 sur l'axe z) : 1 = avance à pleine vitesse tant que le geste
    // "index tendu seul" est maintenu.
    POINT_FORWARD_SPEED: 1,
    // Sensibilité de virage gauche/droite pendant qu'on pointe (déplacement
    // horizontal de la main par rapport au centre de l'image caméra).
    POINT_STEER_SENSITIVITY: 3,

    // --- Sauter : geste "main ouverte levée rapidement vers le haut" ---
    // Se base sur la vélocité verticale RÉELLE du poignet (handState.velocity.y,
    // déjà en unités de jeu/s, voir handTracking.js) : au-delà de ce seuil on
    // considère que c'est un geste de saut volontaire, pas un tremblement.
    JUMP_VELOCITY_THRESHOLD: 3.2,
    JUMP_DEBOUNCE: 0.35, // anti-rebond entre deux sauts déclenchés par geste

    // --- "Toucher l'écran" avec le doigt (tap virtuel, hacking/menus) ---
    // On approxime un "clic" par un geste de poussée de l'index vers la
    // caméra (comme appuyer un bouton dans le vide) : on suit l'écartement
    // poignet -> base du majeur (proxy de la taille apparente de la main
    // dans l'image) et on détecte sa croissance rapide, signe que la main se
    // rapproche brusquement de la caméra. Hypothèse assumée : ce n'est pas
    // une vraie mesure de distance (MediaPipe ne la donne pas), juste un
    // proxy visuel — à recalibrer si le tap se déclenche trop souvent/peu.
    TAP_SPAN_GROWTH_THRESHOLD: 0.6, // croissance relative de l'écartement / s
    TAP_DEBOUNCE: 0.4,
  },

  // --- Rendu stéréoscopique Cardboard (SBS + distorsion en barillet) ---
  // Constantes physiques exactes du visualisateur (décodées du QR code /
  // profil du viewer).
  CARDBOARD: {
    IPD: 0.064,                 // écart inter-pupillaire / inter-lentilles (m)
    SCREEN_TO_LENS_DISTANCE: 0.050, // distance écran → lentille (m)
    TRAY_TO_LENS_CENTER: 0.035,     // décalage plateau → centre optique (m)
    DISTORTION_K1: 0.25,
    DISTORTION_K2: 0.22,
    EYE_OFFSET: 0.032,           // = IPD / 2, décalage caméra gauche/droite
  },
};
