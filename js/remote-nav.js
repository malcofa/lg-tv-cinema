/**
 * Spatial navigation para mandos a distancia sin cursor (TV no-Magic).
 * Flechas → mueven foco en 2D entre elementos focusables.
 * Enter → activa (click) el elemento focusado.
 * Esc/Back (461 webOS, 10009 Samsung) → retrocede (cierra modal/player).
 *
 * Auto-activa el "remote mode" apenas se toca una flecha. Se desactiva
 * cuando el usuario mueve el mouse o toca la pantalla.
 */
(function(global) {
  'use strict';

  const FOCUSED = 'tv-focused';
  const BODY_REMOTE = 'remote-mode';

  let current = null;
  let mode = 'home'; // home | modal | player
  let active = false;

  function log(...a) { /* console.log('[remote]', ...a); */ }

  function activate() {
    if (active) return;
    active = true;
    document.body.classList.add(BODY_REMOTE);
  }
  function deactivate() {
    if (!active) return;
    active = false;
    document.body.classList.remove(BODY_REMOTE);
    clearFocus();
  }

  function clearFocus() {
    if (current) current.classList.remove(FOCUSED);
    current = null;
  }

  function getFocusables() {
    let selector;
    if (mode === 'player') {
      selector = '#player-overlay .player-close';
    } else if (mode === 'modal') {
      selector = '#detail-modal .modal-close, #detail-modal .modal-actions .btn, #detail-modal .translate-btn';
    } else {
      // home
      const parts = [
        '.site-header .icon-btn',
        '.hero-actions .btn',
        '.categories .card',
        '.search-results .card',
        '.search-bar.open input'
      ];
      selector = parts.join(', ');
    }
    return Array.from(document.querySelectorAll(selector))
      .filter(el => el.offsetParent !== null && !el.disabled);
  }

  function setFocus(el) {
    if (!el) return;
    clearFocus();
    current = el;
    el.classList.add(FOCUSED);
    scrollToEl(el);
  }

  function scrollToEl(el) {
    // Scroll horizontal dentro de la row si el card quedó fuera
    const row = el.closest('.row-items');
    if (row) {
      const r = el.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const pad = 60;
      if (r.right > rr.right - pad) {
        row.scrollBy({ left: r.right - rr.right + pad + 40, behavior: 'smooth' });
      } else if (r.left < rr.left + pad) {
        row.scrollBy({ left: r.left - rr.left - pad - 40, behavior: 'smooth' });
      }
    }
    // Scroll vertical del documento
    const r = el.getBoundingClientRect();
    const h = window.innerHeight;
    const topPad = 120, botPad = 60;
    if (r.top < topPad) {
      window.scrollBy({ top: r.top - topPad, behavior: 'smooth' });
    } else if (r.bottom > h - botPad) {
      window.scrollBy({ top: r.bottom - (h - botPad), behavior: 'smooth' });
    }
  }

  function move(dir) {
    activate();
    const all = getFocusables();
    if (all.length === 0) return;

    if (!current || all.indexOf(current) < 0) {
      setFocus(all[0]);
      return;
    }

    const c = current.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;

    let best = null, bestScore = Infinity;

    for (const el of all) {
      if (el === current) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const GAP = 6;

      let primary = 0, secondary = 0;
      if (dir === 'left') {
        if (x >= cx - GAP) continue;
        primary = cx - x;
        secondary = Math.abs(y - cy);
      } else if (dir === 'right') {
        if (x <= cx + GAP) continue;
        primary = x - cx;
        secondary = Math.abs(y - cy);
      } else if (dir === 'up') {
        if (y >= cy - GAP) continue;
        primary = cy - y;
        secondary = Math.abs(x - cx);
      } else if (dir === 'down') {
        if (y <= cy + GAP) continue;
        primary = y - cy;
        secondary = Math.abs(x - cx);
      }

      // Penaliza distancia perpendicular mucho más (queda en línea recta)
      const score = primary + secondary * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    if (best) setFocus(best);
  }

  function click() {
    if (!current) return;
    // Aseguramos foco nativo antes del click, por si el TV browser lo requiere
    try { current.focus({ preventScroll: true }); } catch (e) {}
    try { current.click(); } catch (e) {}
    // Fallback: disparar MouseEvent explícito
    try {
      current.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {}
  }

  function goBack() {
    window.dispatchEvent(new CustomEvent('tv-back'));
  }

  function setMode(newMode) {
    log('mode ->', newMode);
    mode = newMode;
    if (active) {
      // Reposiciona el foco al primer elemento del nuevo modo
      setTimeout(() => {
        const all = getFocusables();
        if (all.length) setFocus(all[0]);
      }, 80);
    }
  }

  function isInputFocused() {
    const t = document.activeElement && document.activeElement.tagName;
    return t === 'INPUT' || t === 'TEXTAREA';
  }

  function keyDirection(e) {
    const k = e.keyCode;
    const key = e.key;
    if (k === 37 || key === 'ArrowLeft') return 'left';
    if (k === 38 || key === 'ArrowUp') return 'up';
    if (k === 39 || key === 'ArrowRight') return 'right';
    if (k === 40 || key === 'ArrowDown') return 'down';
    return null;
  }
  function isEnterKey(e) {
    return e.keyCode === 13 || e.key === 'Enter' || e.keyCode === 32 || e.key === ' ';
  }
  function isBackKey(e) {
    const k = e.keyCode;
    const key = e.key;
    return k === 27 || k === 461 || k === 10009 || key === 'Escape' || key === 'GoBack' || key === 'BrowserBack';
  }

  function onKeyDown(e) {
    if (isInputFocused()) {
      if (isBackKey(e)) {
        document.activeElement.blur();
        e.preventDefault();
        return;
      }
      const dir = keyDirection(e);
      if (dir === 'down' || dir === 'up') {
        document.activeElement.blur();
        e.preventDefault();
        move(dir);
        return;
      }
      // Resto: que el input las maneje (letras, espacio, cursor left/right)
      return;
    }

    const dir = keyDirection(e);
    if (dir) {
      e.preventDefault();
      e.stopPropagation();
      move(dir);
      return;
    }
    if (isEnterKey(e)) {
      if (current) {
        e.preventDefault();
        e.stopPropagation();
        click();
      }
      return;
    }
    if (isBackKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      goBack();
      return;
    }
  }

  // Capture phase: intercepta antes que el navegador de la TV maneje las flechas para scroll nativo
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousemove', () => {
    if (active) deactivate();
  });
  document.addEventListener('touchstart', () => {
    if (active) deactivate();
  }, { passive: true });

  global.RemoteNav = { setMode, setFocus, clearFocus, activate, deactivate, getFocusables };
})(window);
