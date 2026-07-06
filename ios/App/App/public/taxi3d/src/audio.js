let ctx = null;
let osc = null;
let gain = null;

export function initAudio() {
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Create engine oscillator
    osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 80;

    gain = ctx.createGain();
    gain.gain.value = 0;

    // Low-pass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    // Sub oscillator for rumble
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 40;
    const gain2 = ctx.createGain();
    gain2.gain.value = 0;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();

    ctx._osc2 = osc2;
    ctx._gain2 = gain2;
  } catch (e) {
    console.warn('Audio not available:', e);
  }
}

export function updateAudio(carState) {
  if (!ctx || !osc || !gain) return;
  if (ctx.state === 'suspended') {
    ctx.resume();
    return;
  }

  const speed = carState.speed || 0;
  const rpm = carState.rpm || 0.5;

  // Frequency: base idle (60Hz) + speed contribution
  const freq = 55 + rpm * 100 + speed * 1.5;
  osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  if (ctx._osc2) {
    ctx._osc2.frequency.setTargetAtTime(freq * 0.5, ctx.currentTime, 0.05);
  }

  // Volume: engine load sound
  const vol = Math.min(0.15, 0.03 + rpm * 0.08 + speed * 0.002);
  gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
  if (ctx._gain2) {
    ctx._gain2.gain.setTargetAtTime(vol * 0.3, ctx.currentTime, 0.05);
  }
}
