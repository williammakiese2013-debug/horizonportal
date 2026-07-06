const AMBIENT_COLORS = [0xff6600, 0x0066ff, 0x00ff66, 0xff00aa, 0x6600ff, 0x00ccff, 0xff2200, 0xffffff, 0x000000];

let car = {
  mesh: null,
  steerWheel: null,
  steerRotation: 0,
  speed: 0,
  rpm: 0.5,
  pos: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  accelInput: 0,
  brakeInput: 0,
  steerInput: 0,
  hornActive: false,
  ambientLights: [],
  ambientColorIdx: 0,
};

const PHYS = { accelForce: 12, brakeForce: 18, drag: 0.3, maxSpeed: 45, steerSpeed: 2.5, steerReturn: 3.0 };

let mats = {};

function initMats() {
  const T = THREE;

  // Exterior - Taxi jaune
  mats.body = new T.MeshPhysicalMaterial({
    color: 0xF5C518, metalness: 0.4, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.8,
  });
  mats.windshield = new T.MeshPhysicalMaterial({
    color: 0x88BBEE, metalness: 0, roughness: 0, transparent: true, opacity: 0.25, envMapIntensity: 0.4, side: T.DoubleSide,
  });
  mats.windowTint = new T.MeshPhysicalMaterial({
    color: 0x224466, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.45, envMapIntensity: 0.3, side: T.DoubleSide,
  });
  mats.taxiSign = new T.MeshStandardMaterial({ color: 0xffee44, emissive: 0xffdd22, emissiveIntensity: 1.0 });

  // Tires & rims (BMW style)
  mats.tire = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0 });
  mats.rim = new T.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.12 });

  // Lights
  mats.headlight = new T.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 0.8, roughness: 0, metalness: 0, clearcoat: 0.5 });
  mats.taillight = new T.MeshPhysicalMaterial({ color: 0xcc2222, emissive: 0xff2200, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0 });

  // INTERIOR — BMW INSPIRED

  // Dashboard
  mats.dash = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.05 });
  mats.dashPad = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8, metalness: 0 });

  // Digital screens (BMW Curved Display)
  mats.screen = new T.MeshStandardMaterial({ color: 0x001133, emissive: 0x2255aa, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2 });
  mats.screenGlare = new T.MeshPhysicalMaterial({ color: 0x112244, metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.25 });

  // Carbon fiber trim
  mats.carbon = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.35 });

  // Brushed aluminum
  mats.aluminum = new T.MeshStandardMaterial({ color: 0x999aaa, metalness: 0.85, roughness: 0.12 });

  // Chrome accents
  mats.chrome = new T.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.08 });

  // M Sport steering wheel
  mats.steer = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, metalness: 0.05 });
  mats.steerGrip = new T.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0 });
  mats.steerStitch = new T.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4 });

  // Seats (Sensatec / Vernasca leather)
  mats.seat = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0 });
  mats.seatStitch = new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3 });

  // M colors
  mats.Mblue = new T.MeshStandardMaterial({ color: 0x0066cc, emissive: 0x003366, emissiveIntensity: 0.15 });
  mats.Mred = new T.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x661111, emissiveIntensity: 0.15 });

  // Ambient lighting (changeable color)
  mats.ambientGlow = new T.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 0.25 });

  // Door panels
  mats.doorPanel = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.05 });
  mats.speaker = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9, metalness: 0.1 });

  // Headliner (Alcantara)
  mats.alcantara = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95, metalness: 0 });

  // Floor, pillars
  mats.floorMat = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  mats.pillar = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
}

function createInstrumentTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');

  // Dark gradient bg
  const bg = x.createRadialGradient(256, 130, 20, 256, 130, 200);
  bg.addColorStop(0, '#0f1f35');
  bg.addColorStop(1, '#060e1a');
  x.fillStyle = bg;
  x.fillRect(0, 0, 512, 256);

  // Glow ring
  x.strokeStyle = '#1a3a6a';
  x.lineWidth = 2;
  x.beginPath();
  x.arc(256, 220, 195, Math.PI * 0.7, Math.PI * 2.3);
  x.stroke();

  // Speed arc
  const gradArc = x.createLinearGradient(50, 220, 462, 220);
  gradArc.addColorStop(0, '#00aa44');
  gradArc.addColorStop(0.7, '#00aa44');
  gradArc.addColorStop(0.85, '#ffaa00');
  gradArc.addColorStop(1, '#ff2200');
  x.strokeStyle = gradArc;
  x.lineWidth = 4;
  x.beginPath();
  x.arc(256, 220, 185, Math.PI * 0.75, Math.PI * 2.25);
  x.stroke();

  // Tick marks
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI * 0.75 + (i / 20) * Math.PI * 1.5;
    const inner = i % 5 === 0 ? 165 : 175;
    const outer = 185;
    x.strokeStyle = i % 5 === 0 ? '#ffffff' : '#4a6a8a';
    x.lineWidth = i % 5 === 0 ? 2 : 1;
    x.beginPath();
    x.moveTo(256 + Math.cos(a) * outer, 220 + Math.sin(a) * outer);
    x.lineTo(256 + Math.cos(a) * inner, 220 + Math.sin(a) * inner);
    x.stroke();
  }
  // Speed numbers
  x.fillStyle = '#aaccee';
  x.font = '11px sans-serif';
  x.textAlign = 'center';
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    const val = i * 30;
    x.fillText(val, 256 + Math.cos(a) * 150, 220 + Math.sin(a) * 150 + 4);
  }

  // Digital speed (center)
  x.fillStyle = '#ffffff';
  x.font = 'bold 60px monospace';
  x.textAlign = 'center';
  x.fillText('0', 256, 148);
  x.fillStyle = '#6688aa';
  x.font = '12px sans-serif';
  x.fillText('km/h', 256, 168);

  // Gear
  x.fillStyle = '#00dd44';
  x.font = 'bold 28px sans-serif';
  x.fillText('D', 256, 68);

  // Fuel gauge
  x.fillStyle = '#1a2a3a';
  x.fillRect(380, 30, 80, 10);
  x.fillStyle = '#00cc44';
  x.fillRect(382, 32, 55, 6);
  x.fillStyle = '#6688aa';
  x.font = '8px sans-serif';
  x.fillText('⛽', 365, 38);

  // Temp gauge
  x.fillStyle = '#1a2a3a';
  x.fillRect(380, 50, 80, 10);
  x.fillStyle = '#44aaff';
  x.fillRect(382, 52, 40, 6);
  x.fillStyle = '#6688aa';
  x.font = '8px sans-serif';
  x.fillText('🌡', 365, 58);

  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function createInfotainmentTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const x = c.getContext('2d');

  // Background
  x.fillStyle = '#0a1628';
  x.fillRect(0, 0, 512, 320);

  // === Status bar ===
  x.fillStyle = '#0d1f3c';
  x.fillRect(0, 0, 512, 26);
  x.fillStyle = '#ffffff';
  x.font = '10px sans-serif';
  x.textAlign = 'left';
  x.fillText('12:45', 12, 17);
  x.textAlign = 'right';
  x.fillStyle = '#88bbcc';
  x.fillText('24°C  ● ● ● ● ○', 500, 17);

  // === NAVIGATION MAP (left 60%) ===
  x.fillStyle = '#0f1f2f';
  x.fillRect(0, 26, 300, 260);

  // Grid lines
  x.strokeStyle = '#152a3a';
  x.lineWidth = 0.5;
  for (let i = 0; i < 12; i++) {
    x.beginPath();
    x.moveTo(i * 25, 26);
    x.lineTo(i * 25, 286);
    x.stroke();
    x.beginPath();
    x.moveTo(0, 26 + i * 20);
    x.lineTo(300, 26 + i * 20);
    x.stroke();
  }

  // Roads
  x.strokeStyle = '#2a4a6a';
  x.lineWidth = 3;
  const roads = [[20,40,280,260],[10,150,290,80],[150,26,50,286],[200,26,200,286],[80,26,80,286]];
  for (const r of roads) {
    x.beginPath();
    x.moveTo(r[0], r[1]);
    x.lineTo(r[2], r[3]);
    x.stroke();
  }

  // Main road (highlighted)
  x.strokeStyle = '#4477aa';
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(290, 40);
  x.lineTo(150, 150);
  x.lineTo(80, 260);
  x.stroke();

  // GPS pin
  x.fillStyle = '#2266ff';
  x.beginPath();
  x.arc(150, 150, 7, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.arc(150, 150, 3, 0, Math.PI * 2);
  x.fill();
  // Pin shadow
  x.fillStyle = '#2266ff40';
  x.beginPath();
  x.arc(150, 154, 8, 0, Math.PI * 2);
  x.fill();

  // Destination marker
  x.fillStyle = '#ff4422';
  x.beginPath();
  x.arc(80, 260, 5, 0, Math.PI * 2);
  x.fill();

  // Route line
  x.strokeStyle = '#2266ff40';
  x.lineWidth = 2;
  x.setLineDash([3, 3]);
  x.beginPath();
  x.moveTo(150, 150);
  x.lineTo(80, 260);
  x.stroke();
  x.setLineDash([]);

  // Map labels
  x.fillStyle = '#4a7a9a';
  x.font = '8px sans-serif';
  x.fillText('Rue de Rivoli', 60, 140);
  x.fillText('Boulevard Saint-Germain', 180, 90);

  // Zoom controls
  x.fillStyle = '#1a2a3a';
  x.fillRect(270, 30, 24, 40);
  x.fillStyle = '#ffffff';
  x.font = '14px sans-serif';
  x.textAlign = 'center';
  x.fillText('+', 282, 49);
  x.fillText('−', 282, 66);

  // Search bar
  x.fillStyle = '#1a2a3a';
  x.fillRect(8, 292, 284, 22);
  x.strokeStyle = '#2a4a6a';
  x.lineWidth = 1;
  x.strokeRect(8, 292, 284, 22);
  x.fillStyle = '#4a6a8a';
  x.font = '10px sans-serif';
  x.textAlign = 'left';
  x.fillText('🔍  Aller à...', 16, 307);

  // === MEDIA / INFO PANEL (right 40%) ===
  x.fillStyle = '#0d1a2a';
  x.fillRect(300, 26, 212, 260);

  // Now Playing
  x.fillStyle = '#ffffff';
  x.font = 'bold 11px sans-serif';
  x.textAlign = 'left';
  x.fillText('EN COURS', 312, 50);

  // Album art placeholder
  x.fillStyle = '#1a2a3a';
  x.fillRect(312, 56, 80, 80);
  x.strokeStyle = '#2a4a6a';
  x.strokeRect(312, 56, 80, 80);
  // Note icon
  x.fillStyle = '#4a6a8a';
  x.font = '28px sans-serif';
  x.textAlign = 'center';
  x.fillText('♪', 352, 108);

  // Track info
  x.fillStyle = '#ffffff';
  x.font = '12px sans-serif';
  x.textAlign = 'left';
  x.fillText('Stairway to Heaven', 400, 76);
  x.fillStyle = '#6688aa';
  x.font = '10px sans-serif';
  x.fillText('Led Zeppelin', 400, 92);
  x.fillText('IV · 1971', 400, 106);

  // Progress bar
  x.fillStyle = '#1a2a3a';
  x.fillRect(312, 142, 188, 3);
  x.fillStyle = '#2266ff';
  x.fillRect(312, 142, 70, 3);
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.arc(382, 143, 4, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#4a6a8a';
  x.font = '8px sans-serif';
  x.fillText('2:34', 312, 156);
  x.fillText('6:42', 483, 156);

  // Controls
  const ctrls = ['⏮', '▶', '⏭'];
  for (let i = 0; i < 3; i++) {
    x.fillStyle = i === 1 ? '#2266ff' : '#ffffff';
    x.font = i === 1 ? '16px sans-serif' : '14px sans-serif';
    x.textAlign = 'center';
    x.fillText(ctrls[i], 340 + i * 50, 180);
  }

  // === PHONE / CALL SECTION ===
  x.fillStyle = '#0a1424';
  x.fillRect(300, 192, 212, 94);

  x.fillStyle = '#ffffff';
  x.font = 'bold 11px sans-serif';
  x.textAlign = 'left';
  x.fillText('TÉLÉPHONE', 312, 212);

  // Contact
  x.fillStyle = '#1a2a3a';
  x.beginPath();
  x.arc(330, 236, 16, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#4a6a8a';
  x.font = '12px sans-serif';
  x.textAlign = 'center';
  x.fillText('👤', 330, 241);
  x.fillStyle = '#ffffff';
  x.font = '11px sans-serif';
  x.textAlign = 'left';
  x.fillText('Marie Dupont', 354, 234);
  x.fillStyle = '#44cc44';
  x.font = '9px sans-serif';
  x.fillText('● Appel en cours', 354, 250);

  // Call controls
  x.fillStyle = '#cc3333';
  x.beginPath();
  x.arc(340, 268, 10, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#ffffff';
  x.font = '8px sans-serif';
  x.textAlign = 'center';
  x.fillText('✕', 340, 271);

  x.fillStyle = '#2266ff';
  x.beginPath();
  x.arc(370, 268, 10, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#ffffff';
  x.font = '8px sans-serif';
  x.fillText('🔇', 370, 271);

  // === BOTTOM SHORTCUT BAR ===
  x.fillStyle = '#0d1f3c';
  x.fillRect(0, 286, 512, 34);
  const icons = ['📍', '📞', '🎵', '⚙', '🔙'];
  const labels = ['Nav', 'Tel', 'Media', 'Régl', 'Retour'];
  for (let i = 0; i < 5; i++) {
    const ix = 30 + i * 100;
    // Active icon highlight
    if (i === 0) {
      x.fillStyle = '#2266ff40';
      x.fillRect(ix - 28, 288, 56, 30);
    }
    x.fillStyle = i === 0 ? '#ffffff' : '#4a6a8a';
    x.font = '12px sans-serif';
    x.textAlign = 'center';
    x.fillText(icons[i], ix, 305);
    x.font = '8px sans-serif';
    x.fillText(labels[i], ix, 316);
  }

  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

export function buildCar() {
  initMats();
  const T = THREE;
  const g = new T.Group();
  car.mesh = g;

  // Create screen textures
  const instrumentTex = createInstrumentTexture();
  const infotainmentTex = createInfotainmentTexture();

  const bodyW = 1.6, bodyH = 0.9, bodyL = 3.6;
  const driverX = 0.35; // RHD: driver on right

  // ============================================================
  // EXTERIOR BODY
  // ============================================================
  const bodyMesh = new T.Mesh(new T.BoxGeometry(bodyW, bodyH, bodyL), mats.body);
  bodyMesh.position.y = 0.5;
  bodyMesh.castShadow = true;
  g.add(bodyMesh);

  // Bonnet bulge (subtle center ridge)
  const bonnet = new T.Mesh(new T.BoxGeometry(0.7, 0.03, 0.5), mats.body);
  bonnet.position.set(0, 0.96, -0.9);
  g.add(bonnet);

  // Cabin
  const cabinMesh = new T.Mesh(new T.BoxGeometry(bodyW * 0.85, 0.55, bodyL * 0.55), mats.body);
  cabinMesh.position.set(0, 1.0, -0.15);
  cabinMesh.castShadow = true;
  g.add(cabinMesh);

  // ============================================================
  // WINDOWS
  // ============================================================
  const ws = new T.Mesh(new T.PlaneGeometry(bodyW * 0.7, 0.45), mats.windshield);
  ws.position.set(0, 1.05, -1.25);
  ws.rotation.x = 0.2;
  g.add(ws);

  const rw = new T.Mesh(new T.PlaneGeometry(bodyW * 0.7 * 0.9, 0.45 * 0.8), mats.windowTint);
  rw.position.set(0, 1.0, 1.2);
  rw.rotation.x = -0.2;
  g.add(rw);

  for (let side = -1; side <= 1; side += 2) {
    const sw = new T.Mesh(new T.PlaneGeometry(bodyL * 0.35, 0.35), mats.windowTint);
    sw.position.set(side * 0.6, 1.0, -0.2);
    sw.rotation.y = Math.PI / 2 * side;
    g.add(sw);
  }

  // ============================================================
  // INTERIOR — DASHBOARD (BMW Layered Design)
  // ============================================================
  // Main dash base slab
  const dashMain = new T.Mesh(new T.BoxGeometry(1.3, 0.06, 0.35), mats.dash);
  dashMain.position.set(0, 0.74, -0.95);
  g.add(dashMain);

  // Upper dash pad (soft-touch surface)
  const dashUpper = new T.Mesh(new T.BoxGeometry(1.25, 0.03, 0.3), mats.dashPad);
  dashUpper.position.set(0, 0.77, -0.93);
  g.add(dashUpper);

  // Dash layer 2 — carbon fiber trim strip
  const cfTrim = new T.Mesh(new T.BoxGeometry(1.1, 0.015, 0.28), mats.carbon);
  cfTrim.position.set(0, 0.753, -0.94);
  g.add(cfTrim);

  // Dashboard stitching (BMW signature contrast stitching)
  const stitchLine = new T.Mesh(new T.BoxGeometry(1.1, 0.005, 0.002), mats.seatStitch);
  stitchLine.position.set(0, 0.768, -0.94);
  g.add(stitchLine);

  // ============================================================
  // BMW CURVED DISPLAY (instrument cluster + infotainment)
  // ============================================================
  // The curved display is a wide panel behind the steering wheel
  // stretching from driver side to center. We simulate the curve
  // with two angled screen segments.

  // Main screen housing (curved shape — we use a wide angled box)
  const screenHousing = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 0.06), mats.dash);
  screenHousing.position.set(0.15, 0.8, -1.02);
  g.add(screenHousing);

  // Instrument cluster screen (digital, behind steering wheel)
  const instrMat = new T.MeshStandardMaterial({
    map: instrumentTex, emissive: 0xffffff, emissiveIntensity: 0.25,
    emissiveMap: instrumentTex, roughness: 0.15, metalness: 0.05,
  });
  const instrScreen = new T.Mesh(new T.BoxGeometry(0.3, 0.15, 0.015), instrMat);
  instrScreen.position.set(0.35, 0.82, -1.03);
  g.add(instrScreen);

  // Instrument cluster housing
  const instrHousing = new T.Mesh(new T.BoxGeometry(0.34, 0.19, 0.03), mats.dash);
  instrHousing.position.set(0.35, 0.82, -1.04);
  g.add(instrHousing);

  // Infotainment screen (iDrive with GPS/music/phone)
  const infoMat = new T.MeshStandardMaterial({
    map: infotainmentTex, emissive: 0xffffff, emissiveIntensity: 0.25,
    emissiveMap: infotainmentTex, roughness: 0.12, metalness: 0.05,
  });
  const infoScreen = new T.Mesh(new T.BoxGeometry(0.55, 0.19, 0.015), infoMat);
  infoScreen.position.set(-0.02, 0.815, -1.03);
  g.add(infoScreen);

  // Infotainment housing
  const infoHousing = new T.Mesh(new T.BoxGeometry(0.59, 0.23, 0.03), mats.dash);
  infoHousing.position.set(-0.02, 0.815, -1.04);
  g.add(infoHousing);

  // Curved connecting element between the two screens (BMW signature)
  const connectBar = new T.Mesh(new T.BoxGeometry(0.06, 0.17, 0.025), mats.dash);
  connectBar.position.set(0.16, 0.815, -1.035);
  g.add(connectBar);

  // ============================================================
  // BMW AIR VENTS (horizontal chrome-accented)
  // ============================================================
  for (let i = 0; i < 3; i++) {
    const ventX = -0.3 + i * 0.25;
    // Vent housing
    const ventBody = new T.Mesh(new T.BoxGeometry(0.18, 0.04, 0.04), mats.dash);
    ventBody.position.set(ventX, 0.76, -1.0);
    g.add(ventBody);
    // Chrome slats
    for (let s = -1; s <= 1; s++) {
      const slat = new T.Mesh(new T.BoxGeometry(0.16, 0.005, 0.025), mats.chrome);
      slat.position.set(ventX, 0.76 + s * 0.01, -1.02);
      g.add(slat);
    }
    // Center thumb wheel
    const thumb = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.025, 8), mats.chrome);
    thumb.rotation.z = Math.PI / 2;
    thumb.position.set(ventX, 0.76, -1.03);
    g.add(thumb);
  }

  // ============================================================
  // M SPORT STEERING WHEEL (flat-bottom, thick grip)
  // ============================================================
  const steerGroup = new T.Group();
  steerGroup.position.set(driverX, 0.72, -0.6);

  // Main ring — flat bottom via arc parameter (1.6 = ~288°)
  const steerRing = new T.Mesh(
    new T.TorusGeometry(0.19, 0.032, 12, 30, Math.PI * 1.6),
    mats.steer
  );
  steerRing.rotation.x = Math.PI / 2.4;
  steerRing.rotation.z = 0.12;
  steerRing.rotation.y = 0.25;
  steerGroup.add(steerRing);

  // Inner ring (thicker section, slightly smaller — simulates the M Sport thickness variation)
  const innerRing = new T.Mesh(
    new T.TorusGeometry(0.175, 0.028, 10, 28, Math.PI * 1.55),
    mats.steer
  );
  innerRing.rotation.x = Math.PI / 2.4;
  innerRing.rotation.z = 0.12;
  innerRing.rotation.y = 0.3;
  steerGroup.add(innerRing);

  // Thick grip padding at 9-and-3 positions (M Sport bulge)
  for (let ang = -1; ang <= 1; ang += 2) {
    const padAng = ang * 0.45;
    const pad = new T.Mesh(new T.BoxGeometry(0.04, 0.07, 0.04), mats.steerGrip);
    pad.position.set(Math.cos(padAng) * 0.185, Math.sin(padAng) * 0.185 + 0.01, 0);
    pad.rotation.z = -padAng;
    steerGroup.add(pad);
    // Stitching line on grip
    const stitch = new T.Mesh(new T.BoxGeometry(0.005, 0.05, 0.008), mats.steerStitch);
    stitch.position.set(Math.cos(padAng) * 0.19, Math.sin(padAng) * 0.19 + 0.01, 0.025);
    stitch.rotation.z = -padAng;
    steerGroup.add(stitch);
  }

  // M Sport spokes (3 spokes, lower spoke is M style)
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const spokeLen = 0.14;
    // Main spoke arm — tapered look
    const spoke = new T.Mesh(new T.BoxGeometry(0.025, spokeLen, 0.025), mats.steer);
    spoke.position.set(Math.cos(ang) * spokeLen / 2, Math.sin(ang) * spokeLen / 2 + 0.01, 0);
    spoke.rotation.z = -ang;
    steerGroup.add(spoke);
    // Wider base at hub
    const base = new T.Mesh(new T.BoxGeometry(0.035, 0.035, 0.02), mats.steer);
    base.position.set(Math.cos(ang) * 0.055, Math.sin(ang) * 0.055 + 0.01, 0);
    base.rotation.z = -ang;
    steerGroup.add(base);
  }

  // Center hub (larger, more prominent)
  const hub = new T.Mesh(new T.CylinderGeometry(0.065, 0.07, 0.04, 16), mats.steer);
  hub.position.z = -0.015;
  steerGroup.add(hub);

  // Hub chrome ring
  const hubRing = new T.Mesh(new T.TorusGeometry(0.06, 0.005, 8, 16), mats.chrome);
  hubRing.position.z = -0.018;
  steerGroup.add(hubRing);

  // M badge (tricolor stripes)
  for (let mi = 0; mi < 3; mi++) {
    const mColor = mi === 0 ? mats.Mblue : mi === 1 ? mats.Mred : mats.chrome;
    const stripe = new T.Mesh(new T.BoxGeometry(0.012, 0.022, 0.003), mColor);
    stripe.position.set(0.022 * (mi - 1), -0.042, -0.038);
    steerGroup.add(stripe);
  }

  // Shift paddles behind steering wheel (larger, more realistic)
  for (let side = -1; side <= 1; side += 2) {
    const paddleBase = new T.Mesh(new T.BoxGeometry(0.006, 0.055, 0.04), mats.aluminum);
    paddleBase.position.set(side * 0.14, 0.01, -0.045);
    paddleBase.rotation.x = 0.35;
    steerGroup.add(paddleBase);
    // Paddle shift extension
    const paddleExt = new T.Mesh(new T.BoxGeometry(0.004, 0.035, 0.025), mats.aluminum);
    paddleExt.position.set(side * 0.14, -0.02, -0.055);
    paddleExt.rotation.x = 0.15;
    steerGroup.add(paddleExt);
  }

  // Steering column shroud
  const columnShroud = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.2, 10), mats.dash);
  columnShroud.position.set(driverX, 0.55, -0.5);
  columnShroud.rotation.x = Math.PI / 2.5;
  g.add(columnShroud);

  // Ignition/start button (BMW red start-stop)
  const startBtn = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.005, 8), mats.Mred);
  startBtn.position.set(driverX + 0.08, 0.78, -0.88);
  startBtn.rotation.x = Math.PI / 2;
  g.add(startBtn);

  g.add(steerGroup);
  car.steerWheel = steerGroup;

  // ============================================================
  // CENTER CONSOLE (with iDrive controller)
  // ============================================================
  // Console base structure
  const consoleBase = new T.Mesh(new T.BoxGeometry(0.3, 0.2, 0.8), mats.dash);
  consoleBase.position.set(-0.05, 0.35, -0.3);
  g.add(consoleBase);

  // Carbon trim on console
  const consoleTrim = new T.Mesh(new T.BoxGeometry(0.28, 0.01, 0.7), mats.carbon);
  consoleTrim.position.set(-0.05, 0.46, -0.3);
  g.add(consoleTrim);

  // iDrive rotary controller
  const idriveBase = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.01, 12), mats.aluminum);
  idriveBase.position.set(-0.05, 0.47, -0.35);
  g.add(idriveBase);

  const idriveKnob = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, 0.02, 12), mats.chrome);
  idriveKnob.position.set(-0.05, 0.49, -0.35);
  g.add(idriveKnob);

  // Touchpad on top of iDrive knob
  const idriveTouch = new T.Mesh(new T.CircleGeometry(0.025, 12), mats.dash);
  idriveTouch.position.set(-0.05, 0.501, -0.35);
  idriveTouch.rotation.x = -Math.PI / 2;
  g.add(idriveTouch);

  // Gear selector (BMW small toggle)
  const gearGate = new T.Mesh(new T.BoxGeometry(0.05, 0.005, 0.1), mats.chrome);
  gearGate.position.set(-0.05, 0.47, -0.5);
  g.add(gearGate);

  const gearLever = new T.Mesh(new T.BoxGeometry(0.02, 0.04, 0.02), mats.steer);
  gearLever.position.set(-0.05, 0.49, -0.5);
  g.add(gearLever);

  // P-R-N-D indicators
  for (let gi = 0; gi < 4; gi++) {
    const label = ['P', 'R', 'N', 'D'][gi];
    const ind = new T.Mesh(new T.BoxGeometry(0.015, 0.001, 0.015), mats.chrome);
    ind.position.set(-0.05 + (gi - 1.5) * 0.025, 0.476, -0.5);
    g.add(ind);
  }

  // Cup holders
  for (let c = -1; c <= 1; c += 2) {
    const cup = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, 0.04, 8), mats.dash);
    cup.position.set(-0.05 + c * 0.06, 0.25, -0.15);
    g.add(cup);
  }

  // Armrest
  const armrest = new T.Mesh(new T.BoxGeometry(0.2, 0.04, 0.15), mats.seat);
  armrest.position.set(-0.05, 0.47, 0.05);
  g.add(armrest);

  // ============================================================
  // SEATS — BMW Sport Seats
  // ============================================================
  function makeSportSeat(x, z) {
    // Cushion base
    const cushion = new T.Mesh(new T.BoxGeometry(0.45, 0.08, 0.45), mats.seat);
    cushion.position.set(x, 0.2, z);
    g.add(cushion);

    // Side bolsters (left and right of cushion)
    for (let side = -1; side <= 1; side += 2) {
      const bolster = new T.Mesh(new T.BoxGeometry(0.06, 0.1, 0.42), mats.seat);
      bolster.position.set(x + side * 0.24, 0.25, z);
      g.add(bolster);
    }

    // Seat backrest (sport shape — wider at top)
    const backBase = new T.Mesh(new T.BoxGeometry(0.38, 0.3, 0.06), mats.seat);
    backBase.position.set(x, 0.45, z - 0.24);
    g.add(backBase);

    // Backrest side bolsters
    for (let side = -1; side <= 1; side += 2) {
      const bBolt = new T.Mesh(new T.BoxGeometry(0.06, 0.35, 0.06), mats.seat);
      bBolt.position.set(x + side * 0.22, 0.45, z - 0.24);
      g.add(bBolt);
    }

    // Integrated headrest
    const headrest = new T.Mesh(new T.BoxGeometry(0.2, 0.1, 0.05), mats.seat);
    headrest.position.set(x, 0.72, z - 0.24);
    g.add(headrest);

    // Headrest "cutout" (slight gap — two posts)
    for (let side = -1; side <= 1; side += 2) {
      const post = new T.Mesh(new T.BoxGeometry(0.015, 0.04, 0.015), mats.chrome);
      post.position.set(x + side * 0.06, 0.64, z - 0.24);
      g.add(post);
    }

    // Seat adjustment controls (on side of seat base)
    const seatCtrl = new T.Mesh(new T.BoxGeometry(0.02, 0.04, 0.02), mats.speaker);
    seatCtrl.position.set(x + 0.26, 0.24, z + 0.05);
    g.add(seatCtrl);

    // M stitching line (topstitch on seat back)
    const stitch = new T.Mesh(new T.BoxGeometry(0.3, 0.005, 0.065), mats.seatStitch);
    stitch.position.set(x, 0.5, z - 0.27);
    g.add(stitch);
  }

  // Driver seat
  makeSportSeat(driverX, -0.15);
  // Passenger seat
  makeSportSeat(-0.35, -0.15);

  // Rear bench (sculpted)
  const rearBench = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.4), mats.seat);
  rearBench.position.set(0, 0.2, 0.55);
  g.add(rearBench);

  // Rear backrest
  const rearBack = new T.Mesh(new T.BoxGeometry(0.85, 0.35, 0.06), mats.seat);
  rearBack.position.set(0, 0.42, 0.72);
  g.add(rearBack);

  // Rear headrests
  for (let side = -1; side <= 1; side += 2) {
    const rh = new T.Mesh(new T.BoxGeometry(0.18, 0.08, 0.04), mats.seat);
    rh.position.set(side * 0.25, 0.68, 0.72);
    g.add(rh);
  }

  // Rear center armrest
  const rearArmrest = new T.Mesh(new T.BoxGeometry(0.2, 0.04, 0.15), mats.seat);
  rearArmrest.position.set(0, 0.35, 0.55);
  g.add(rearArmrest);

  // ============================================================
  // DOOR PANELS (BMW style)
  // ============================================================
  for (let side = -1; side <= 1; side += 2) {
    // Main door card
    const door = new T.Mesh(new T.BoxGeometry(0.025, 0.4, 0.7), mats.doorPanel);
    door.position.set(side * 0.56, 0.55, -0.15);
    g.add(door);

    // Carbon trim insert on door
    const doorTrim = new T.Mesh(new T.BoxGeometry(0.027, 0.08, 0.3), mats.carbon);
    doorTrim.position.set(side * 0.56, 0.5, -0.1);
    g.add(doorTrim);

    // Door handle (chrome)
    const handle = new T.Mesh(new T.BoxGeometry(0.02, 0.015, 0.1), mats.chrome);
    handle.position.set(side * 0.56, 0.6, -0.05);
    g.add(handle);

    // Grab handle (pull recess)
    const grab = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.06), mats.aluminum);
    grab.position.set(side * 0.56, 0.7, -0.1);
    g.add(grab);

    // Speaker grill (in door, near front)
    const spkr = new T.Mesh(new T.CylinderGeometry(0.04, 0.045, 0.005, 12), mats.speaker);
    spkr.position.set(side * 0.56, 0.35, 0.15);
    spkr.rotation.y = Math.PI / 2;
    g.add(spkr);

    // Door pocket
    const pocket = new T.Mesh(new T.BoxGeometry(0.025, 0.06, 0.12), mats.doorPanel);
    pocket.position.set(side * 0.56, 0.2, 0.2);
    g.add(pocket);

    // Window switch cluster
    const winSwitch = new T.Mesh(new T.BoxGeometry(0.015, 0.01, 0.04), mats.chrome);
    winSwitch.position.set(side * 0.56, 0.72, 0.0);
    g.add(winSwitch);
  }

  // ============================================================
  // AMBIENT LIGHTING (multicolor LED strips — change with 'C')
  // ============================================================
  function addAmbient(pos, scale, rot) {
    const m = new T.Mesh(new T.BoxGeometry(...scale), mats.ambientGlow.clone());
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) { m.rotation.x = rot[0] || 0; m.rotation.y = rot[1] || 0; m.rotation.z = rot[2] || 0; }
    g.add(m);
    car.ambientLights.push(m);
    return m;
  }

  // Dashboard ambient strip (full width)
  addAmbient([0.15, 0.765, -0.97], [1.0, 0.005, 0.02]);

  // Center console ambient strip
  addAmbient([-0.19, 0.34, -0.3], [0.005, 0.15, 0.5]);

  // Driver footwell
  addAmbient([driverX, 0.15, -0.2], [0.01, 0.003, 0.1]);

  // Passenger footwell
  addAmbient([-0.35, 0.15, -0.2], [0.01, 0.003, 0.1]);

  // Under-dash glow (driver side)
  addAmbient([driverX + 0.1, 0.2, -0.6], [0.15, 0.003, 0.02]);

  // Under-dash glow (passenger side)
  addAmbient([-0.35, 0.2, -0.6], [0.15, 0.003, 0.02]);

  // Door panel LEDs (both sides)
  for (let side = -1; side <= 1; side += 2) {
    addAmbient([side * 0.56, 0.62, 0.1], [0.025, 0.003, 0.2]);    // door card strip
    addAmbient([side * 0.56, 0.68, -0.05], [0.02, 0.003, 0.08]);  // door handle
  }

  // Rear footwells
  addAmbient([driverX, 0.15, 0.3], [0.01, 0.003, 0.08]);
  addAmbient([-0.35, 0.15, 0.3], [0.01, 0.003, 0.08]);

  // ============================================================
  // HUD (Head-Up Display) — projected on windshield
  // ============================================================
  const hudMat = new T.MeshBasicMaterial({
    color: 0x44ff88, transparent: true, opacity: 0.15, depthWrite: false,
  });
  const hud = new T.Mesh(new T.PlaneGeometry(0.5, 0.12), hudMat);
  hud.position.set(0.15, 1.08, -1.18);
  hud.rotation.x = 0.25;
  g.add(hud);

  // HUD border frame
  const hudFrame = new T.LineSegments(
    new T.EdgesGeometry(new T.PlaneGeometry(0.5, 0.12)),
    new T.LineBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.08 })
  );
  hudFrame.position.copy(hud.position);
  hudFrame.rotation.copy(hud.rotation);
  g.add(hudFrame);

  // ============================================================
  // PILLARS (A, B, C)
  // ============================================================
  for (let side = -1; side <= 1; side += 2) {
    const a = new T.Mesh(new T.BoxGeometry(0.06, 0.55, 0.06), mats.pillar);
    a.position.set(side * 0.52, 0.95, -1.1); g.add(a);
    const b = new T.Mesh(new T.BoxGeometry(0.06, 0.55, 0.06), mats.pillar);
    b.position.set(side * 0.52, 0.95, 0.35); g.add(b);
    const c = new T.Mesh(new T.BoxGeometry(0.06, 0.5, 0.06), mats.pillar);
    c.position.set(side * 0.52, 0.9, 1.0); g.add(c);
  }

  // ============================================================
  // FLOOR
  // ============================================================
  const floor = new T.Mesh(new T.BoxGeometry(bodyW * 0.85, 0.03, bodyL * 0.6), mats.floorMat);
  floor.position.set(0, 0.13, -0.15);
  g.add(floor);

  // Driver foot pedals area
  const pedalBox = new T.Mesh(new T.BoxGeometry(0.05, 0.005, 0.08), mats.dash);
  pedalBox.position.set(driverX, 0.17, -0.6);
  g.add(pedalBox);

  // Gas pedal
  const gasPedal = new T.Mesh(new T.BoxGeometry(0.04, 0.003, 0.07), mats.aluminum);
  gasPedal.position.set(driverX + 0.05, 0.175, -0.62);
  g.add(gasPedal);

  // Brake pedal
  const brakePedal = new T.Mesh(new T.BoxGeometry(0.04, 0.003, 0.05), mats.aluminum);
  brakePedal.position.set(driverX - 0.03, 0.175, -0.6);
  g.add(brakePedal);

  // ============================================================
  // HEADLINER (Alcantara roof lining)
  // ============================================================
  const headliner = new T.Mesh(new T.BoxGeometry(bodyW * 0.7, 0.02, bodyL * 0.5), mats.alcantara);
  headliner.position.set(0, 1.26, -0.15);
  g.add(headliner);

  // Dome light (center)
  const domeLight = new T.Mesh(new T.BoxGeometry(0.04, 0.01, 0.03), mats.aluminum);
  domeLight.position.set(0, 1.27, -0.3);
  g.add(domeLight);

  const domeBulb = new T.Mesh(new T.BoxGeometry(0.02, 0.005, 0.02), mats.ambientGlow);
  domeBulb.position.set(0, 1.265, -0.3);
  g.add(domeBulb);

  // ============================================================
  // INTERIOR REARVIEW MIRROR
  // ============================================================
  const mirror = new T.Mesh(new T.BoxGeometry(0.06, 0.04, 0.005), mats.chrome);
  mirror.position.set(0, 1.18, -1.15);
  g.add(mirror);

  const mirrorGlass = new T.Mesh(new T.BoxGeometry(0.055, 0.035, 0.003), new T.MeshStandardMaterial({
    color: 0x88aacc, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.5,
  }));
  mirrorGlass.position.set(0, 1.18, -1.152);
  g.add(mirrorGlass);

  // ============================================================
  // WHEELS (BMW Sport Rims)
  // ============================================================
  for (let side = -1; side <= 1; side += 2) {
    for (let front = -1; front <= 1; front += 2) {
      const wg = new T.Group();
      wg.position.set(side * 0.75, 0.3, front * 1.05);

      const tire = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.18, 16), mats.tire);
      tire.rotation.z = Math.PI / 2;
      wg.add(tire);

      // BMW multi-spoke rim design
      const rim = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.19, 16), mats.rim);
      rim.rotation.z = Math.PI / 2;
      wg.add(rim);

      // Spokes on rim
      for (let si = 0; si < 5; si++) {
        const sAng = (si / 5) * Math.PI * 2;
        const spokeMesh = new T.Mesh(new T.BoxGeometry(0.08, 0.005, 0.19), mats.rim);
        spokeMesh.position.set(Math.cos(sAng) * 0.08, Math.sin(sAng) * 0.08, 0);
        spokeMesh.rotation.z = Math.PI / 2;
        wg.add(spokeMesh);
      }

      // Center cap with BMW logo (blue/white)
      const cap = new T.Mesh(new T.CircleGeometry(0.025, 8), new T.MeshStandardMaterial({
        color: 0x0055aa, metalness: 0.3, roughness: 0.4,
      }));
      cap.position.z = 0.095;
      wg.add(cap);

      g.add(wg);
    }
  }

  // ============================================================
  // LIGHTS
  // ============================================================
  // Headlights (LED corona rings — BMW signature)
  for (let side = -1; side <= 1; side += 2) {
    // Main projector
    const hl = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), mats.headlight);
    hl.position.set(side * 0.3, 0.5, -1.82);
    g.add(hl);

    // Angel eyes / corona ring (BMW signature)
    const angelEye = new T.Mesh(new T.TorusGeometry(0.045, 0.01, 6, 12), new T.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.6,
    }));
    angelEye.position.set(side * 0.3, 0.5, -1.84);
    g.add(angelEye);

    // Inner LED accent
    const innerLED = new T.Mesh(new T.BoxGeometry(0.02, 0.03, 0.02), mats.headlight);
    innerLED.position.set(side * 0.3 + side * 0.04, 0.48, -1.82);
    g.add(innerLED);
  }

  // Taillights (BMW L-shaped)
  for (let side = -1; side <= 1; side += 2) {
    const tl = new T.Mesh(new T.SphereGeometry(0.05, 8, 8), mats.taillight);
    tl.position.set(side * 0.3, 0.5, 1.82);
    g.add(tl);

    // L-shaped light bar
    const lShape = new T.Mesh(new T.BoxGeometry(0.04, 0.04, 0.03), mats.taillight);
    lShape.position.set(side * 0.27, 0.5, 1.82);
    g.add(lShape);
  }

  // ============================================================
  // TAXI SIGN
  // ============================================================
  const sign = new T.Mesh(new T.BoxGeometry(0.35, 0.08, 0.12), mats.taxiSign);
  sign.position.set(0, 1.4, -0.15);
  g.add(sign);

  // Taxi sign mount
  const signMount = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.06, 4), mats.chrome);
  signMount.position.set(0, 1.33, -0.15);
  g.add(signMount);

  // ============================================================
  // INIT
  // ============================================================
  g.position.copy(car.pos);
  g.rotation.y = car.yaw;
  const scene = window.scene;
  if (scene) scene.add(g);
}

export function updateCarPhysics(dt, controls) {
  if (!controls) return;

  car.accelInput = controls.gas || 0;
  car.brakeInput = controls.brake || 0;
  car.steerInput = controls.steer || 0;
  car.hornActive = controls.horn || false;

  if (car.accelInput > 0) {
    car.speed += car.accelInput * PHYS.accelForce * dt;
  } else if (car.brakeInput > 0) {
    car.speed -= car.brakeInput * PHYS.brakeForce * dt;
  } else {
    car.speed *= (1 - PHYS.drag * dt);
    if (Math.abs(car.speed) < 0.1) car.speed = 0;
  }
  car.speed = Math.max(0, Math.min(PHYS.maxSpeed, car.speed));

  const targetRpm = 0.4 + (car.speed / PHYS.maxSpeed) * 0.6;
  car.rpm += (targetRpm - car.rpm) * dt * 3;

  if (Math.abs(car.steerInput) > 0.1 && car.speed > 0.5) {
    const turnRate = PHYS.steerSpeed * (car.speed / PHYS.maxSpeed + 0.1);
    car.steerRotation += car.steerInput * turnRate * dt;
    car.steerRotation = Math.max(-0.8, Math.min(0.8, car.steerRotation));
  } else {
    car.steerRotation *= (1 - PHYS.steerReturn * dt);
    if (Math.abs(car.steerRotation) < 0.001) car.steerRotation = 0;
  }

  if (Math.abs(car.steerRotation) > 0.01) {
    car.yaw += car.steerRotation * dt * (0.5 + car.speed / PHYS.maxSpeed * 1.5);
  }

  if (car.speed > 0) {
    car.pos.x -= Math.sin(car.yaw) * car.speed * dt;
    car.pos.z -= Math.cos(car.yaw) * car.speed * dt;
  }

  if (car.mesh) {
    car.mesh.position.lerp(car.pos, dt * 10);
    car.mesh.rotation.y = car.yaw;
  }

  if (car.steerWheel) {
    car.steerWheel.rotation.z = car.steerRotation * 1.5;
  }
}

export function getCarState() {
  return {
    speed: car.speed,
    rpm: car.rpm,
    steerRotation: car.steerRotation,
    pos: car.pos,
    yaw: car.yaw,
    hornActive: car.hornActive,
  };
}

export function getSteerWheel() { return car.steerWheel; }

export function getAmbientColorIdx() { return car.ambientColorIdx; }

export function cycleAmbientColor(dir) {
  const n = AMBIENT_COLORS.length;
  car.ambientColorIdx = (car.ambientColorIdx + dir + n) % n;
  const color = AMBIENT_COLORS[car.ambientColorIdx];
  // Update all ambient light strips
  for (const m of car.ambientLights) {
    if (m && m.material) {
      m.material.color.setHex(color);
      m.material.emissive.setHex(color || 0x000000);
      m.material.emissiveIntensity = color === 0x000000 ? 0 : 0.25;
      m.material.needsUpdate = true;
    }
  }
  return color;
}
