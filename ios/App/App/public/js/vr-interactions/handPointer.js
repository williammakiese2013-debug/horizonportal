/* ============================================================
   handPointer.js — Horizon VR GLOBAL POINTER / INPUT DISPATCH
   ============================================================
   Consumes window.HorizonHandNav (handTracking.js) and turns its two
   gestures into real, site-wide interaction:
     - TAP    -> a click, wherever the virtual cursor currently is
     - SCROLL -> a scroll, on whatever is scrollable under the cursor
   Nothing here talks to MediaPipe/WebXR — it only reads gesture state
   and dispatches standard DOM events, exactly like a finger on glass.
   ============================================================ */
(function () {
  function ensureCursor() {
    if (document.getElementById('horizon-nav-cursor')) return;
    const style = document.createElement('style');
    style.id = 'horizon-nav-cursor-style';
    style.textContent = `
      #horizon-nav-cursor{
        position:fixed; top:0; left:0; width:20px; height:20px;
        margin:-10px 0 0 -10px; border-radius:50%;
        border:2px solid #7fe9ff; background:rgba(127,233,255,.15);
        box-shadow:0 0 14px rgba(127,233,255,.5);
        pointer-events:none; z-index:99999; display:none;
        transition: transform .08s ease, background .08s ease, border-color .08s ease;
      }
      #horizon-nav-cursor.hn-tap{ transform:scale(.65); background:rgba(127,233,255,.55); }
      #horizon-nav-cursor.hn-scroll{ border-color:#9dff7f; box-shadow:0 0 14px rgba(157,255,127,.5); }
      #horizon-nav-dwell-ring{
        position:fixed; top:0; left:0; width:30px; height:30px;
        margin:-15px 0 0 -15px; border-radius:50%; pointer-events:none;
        z-index:99998; display:none;
        background:conic-gradient(#7fe9ff calc(var(--p,0) * 360deg), rgba(127,233,255,.12) 0);
        -webkit-mask:radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
                mask:radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
        opacity:.9;
      }
    `;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'horizon-nav-cursor';
    document.body.appendChild(cursor);
    const ring = document.createElement('div');
    ring.id = 'horizon-nav-dwell-ring';
    document.body.appendChild(ring);
  }

  // Reuses the scrollable-ancestor finder already defined in
  // window-grab-move.js (loaded earlier, same global scope) so both
  // gesture systems (pinch-scroll and this Y-glide scroll) agree on what
  // counts as "scrollable". Falls back to a local copy if that file is
  // ever renamed/removed, so this module stays self-sufficient.
  function findScrollTarget(el) {
    if (typeof findScrollableParent === 'function') {
      return findScrollableParent(el, null);
    }
    let n = el;
    while (n && n !== document.body && n !== document.documentElement) {
      if (n.scrollHeight > n.clientHeight + 2) {
        const cs = getComputedStyle(n);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return n;
      }
      n = n.parentElement;
    }
    return null;
  }

  function simulateClick(el, x, y) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
    } catch (e) {
      // PointerEvent unavailable on some older WebViews — .click() below
      // still fires a standard click either way.
    }
    el.click();
  }

  // Panneaux spatiaux world-locked (js/vr-interactions/spatial-panels.js) :
  // Launchpad et fenêtre d'app (dont "Jeux") sont maintenant projetés sur
  // de vrais <a-plane> 3D, comme le navigateur web. window.__spatialPanelHitTest
  // renvoie les coordonnées écran RÉELLES du DOM source (invisible mais
  // toujours dans le flux, voir main.css) correspondant au point du plan
  // touché par le rayon : on se contente de remplacer x/y par ce résultat
  // avant de continuer avec le pipeline normal ci-dessous (elementFromPoint,
  // __handTrackPinchClick, simulateClick...), sans dupliquer cette logique.
  function resolveSpatialPanelXY(x, y) {
    if (typeof window.__spatialPanelHitTest === 'function') {
      const hit = window.__spatialPanelHitTest(x, y);
      if (hit) return hit;
    }
    return null;
  }

  function handleTap(x, y, cursor) {
    cursor.classList.add('hn-tap');
    setTimeout(() => cursor.classList.remove('hn-tap'), 130);

    // Navigateur 3D world-locked (js/vr-interactions/webview-browser.js) :
    // ce n'est pas un élément DOM, c'est un <a-plane> dans la scène 3D, donc
    // elementFromPoint ne peut pas le voir (il ne verrait que le <canvas>
    // WebGL de l'a-scene). On teste d'abord un raycast dédié ; si le rayon
    // touche le plan, on route le tap vers la WKWebView cachée et on
    // s'arrête là, sans toucher au reste du pipeline DOM ci-dessous.
    if (typeof window.__webviewBrowserHitTest === 'function') {
      const hit = window.__webviewBrowserHitTest(x, y);
      if (hit) {
        window.HorizonWebBrowser.tap(hit.uv);
        return;
      }
    }

    // Launchpad / fenêtre d'app ("Jeux") world-locked : même principe,
    // mais le contenu reste du DOM réel (juste invisible à l'écran) donc
    // on peut remapper x/y vers sa position écran réelle et laisser le
    // pipeline DOM classique gérer le clic normalement.
    const spatialXY = resolveSpatialPanelXY(x, y);
    if (spatialXY) { x = spatialXY.x; y = spatialXY.y; }

    // IMPORTANT: read what's under the cursor BEFORE doing anything that
    // can mutate the DOM. Opening an app/window calls renderHUD(), which
    // rebuilds the HUD synchronously — so if we looked this up AFTER that
    // call, elementFromPoint(x, y) could return a completely different
    // element that just got rendered at that exact screen position (e.g.
    // the newly-opened window's own close button), and we'd fire a
    // second, unintended click on it in the very same tap — closing the
    // app the instant it opened. Snapshotting first avoids that race.
    const el = document.elementFromPoint(x, y);
    const hitAppSystemTarget = !!(el && el.closest('[data-action]'));

    // 1) Horizon's custom app/window system (data-action targets, opened
    //    via hover) is already wired to the pinch gesture through this
    //    exact global hook — reuse it so a tap launches apps/windows
    //    exactly like a pinch already does, with no duplicated logic.
    if (typeof window.__handTrackPinchClick === 'function') {
      window.__handTrackPinchClick();
    }

    // 2) Generic DOM fallback — plain buttons, links, media controls,
    //    file pickers, etc. Skipped for data-action targets since those
    //    were just handled by the app system above (avoids double-firing).
    if (el && !hitAppSystemTarget) {
      simulateClick(el, x, y);
    }
  }

  function handleScroll(deltaY, x, y, cursor) {
    cursor.classList.add('hn-scroll');

    if (typeof window.__webviewBrowserHitTest === 'function') {
      const hit = window.__webviewBrowserHitTest(x, y);
      if (hit) {
        window.HorizonWebBrowser.scroll(deltaY);
        return;
      }
    }

    const spatialXY = resolveSpatialPanelXY(x, y);
    if (spatialXY) { x = spatialXY.x; y = spatialXY.y; }

    const el = document.elementFromPoint(x, y);
    const target = el ? findScrollTarget(el) : null;
    if (target) {
      target.scrollTop += deltaY;
    } else {
      window.scrollBy(0, deltaY);
    }
  }

  function loop() {
    ensureCursor();
    const cursor = document.getElementById('horizon-nav-cursor');
    const ring = document.getElementById('horizon-nav-dwell-ring');
    const nav = window.HorizonHandNav;
    if (!nav) {
      requestAnimationFrame(loop);
      return;
    }
    const hs = nav.getState();

    if (!hs.visible || !hs.pointing) {
      cursor.style.display = 'none';
      cursor.classList.remove('hn-scroll');
      if (ring) ring.style.display = 'none';
      requestAnimationFrame(loop);
      return;
    }

    cursor.style.display = 'block';
    cursor.style.left = hs.screenX + 'px';
    cursor.style.top = hs.screenY + 'px';

    if (ring) {
      if (hs.scrollDeltaY) {
        ring.style.display = 'none'; // no dwell ring while actively scrolling
      } else {
        ring.style.display = 'block';
        ring.style.left = hs.screenX + 'px';
        ring.style.top = hs.screenY + 'px';
        ring.style.setProperty('--p', hs.dwellProgress || 0);
      }
    }

    if (hs.tap) {
      handleTap(hs.screenX, hs.screenY, cursor);
    }
    if (hs.scrollDeltaY) {
      handleScroll(hs.scrollDeltaY, hs.screenX, hs.screenY, cursor);
    } else {
      cursor.classList.remove('hn-scroll');
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
