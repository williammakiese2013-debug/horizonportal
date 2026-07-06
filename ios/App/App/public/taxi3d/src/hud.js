export function initHUD() {
  // nothing to init yet
}

export function updateHUD(carState) {
  if (!carState) return;

  const speedKmh = Math.round(carState.speed * 3.6);
  const speedEl = document.getElementById('speed-display');
  if (speedEl) {
    speedEl.innerHTML = speedKmh + ' <small>km/h</small>';
  }

  // RPM bar
  const rpmFill = document.getElementById('rpm-fill');
  if (rpmFill) {
    rpmFill.style.width = (carState.rpm * 100) + '%';
  }

  // Money
  const moneyEl = document.getElementById('money-val');
  if (moneyEl && window.TX) {
    moneyEl.textContent = window.TX.money;
  }

  // Passengers
  const paxEl = document.getElementById('pax-count');
  if (paxEl && window.TX) {
    paxEl.textContent = window.TX.passengers;
  }

  // Time
  const timeEl = document.getElementById('time-display');
  if (timeEl && window.TX) {
    const totalMin = Math.floor(window.TX.time * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    timeEl.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
}
