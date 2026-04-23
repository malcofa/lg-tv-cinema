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
    current.click();
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

  function onKeyDown(e) {
    const k = e.keyCode;

    if (isInputFocused()) {
      // Esc → blur el input
      if (k === 27) {
        document.activeElement.blur();
        e.preventDefault();
        return;
      }
      // Flecha abajo desde el input → salir a navegar resultados
      if (k === 40) {
        document.activeElement.blur();
        e.preventDefault();
        move('down');
        return;
      }
      // Flecha arriba → blur, mover arriba
      if (k === 38) {
        document.activeElement.blur();
        e.preventDefault();
        move('up');
        return;
      }
      // Resto de teclas (letras, espacio, backspace, left/right para cursor): que el input las maneje
      return;
    }

    switch (k) {
      case 37: e.preventDefault(); move('left'); return;
      case 38: e.preventDefault(); move('up'); return;
      case 39: e.preventDefault(); move('right'); return;
      case 40: e.preventDefault(); move('down'); return;
      case 13: // Enter
        if (current) { e.preventDefault(); click(); }
        return;
      case 27:   // Esc
      case 461:  // webOS back
      case 10009: // Samsung back
        e.preventDefault();
        goBack();
        return;
    }
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousemove', () => {
    if (active) deactivate();
  });
  document.addEventListener('touchstart', () => {
    if (active) deactivate();
  }, { passive: true });

  global.RemoteNav = { setMode, setFocus, clearFocus, activate, deactivate, getFocusables };
})(window);
