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
        position:fixed; top:0; left:0; width:30px; height:30px;
        margin:-15px 0 0 -15px; border-radius:50%;
        border:2px solid #7fe9ff; background:rgba(127,233,255,.15);
        box-shadow:0 0 14px rgba(127,233,255,.5);
        pointer-events:none; z-index:99999; display:none;
        transition: transform .08s ease, background .08s ease, border-color .08s ease;
      }
      #horizon-nav-cursor.hn-tap{ transform:scale(.65); background:rgba(127,233,255,.55); }
      #horizon-nav-cursor.hn-scroll{ border-color:#9dff7f; box-shadow:0 0 14px rgba(157,255,127,.5); }
    `;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'horizon-nav-cursor';
    document.body.appendChild(cursor);
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

  function handleTap(x, y, cursor) {
    cursor.classList.add('hn-tap');
    setTimeout(() => cursor.classList.remove('hn-tap'), 130);

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
    const el = document.elementFromPoint(x, y);
    if (el && !el.closest('[data-action]')) {
      simulateClick(el, x, y);
    }
  }

  function handleScroll(deltaY, x, y, cursor) {
    cursor.classList.add('hn-scroll');
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
    const nav = window.HorizonHandNav;
    if (!nav) {
      requestAnimationFrame(loop);
      return;
    }
    const hs = nav.getState();

    if (!hs.visible || !hs.pointing) {
      cursor.style.display = 'none';
      cursor.classList.remove('hn-scroll');
      requestAnimationFrame(loop);
      return;
    }

    cursor.style.display = 'block';
    cursor.style.left = hs.screenX + 'px';
    cursor.style.top = hs.screenY + 'px';

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
