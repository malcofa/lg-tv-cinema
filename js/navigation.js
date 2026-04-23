/**
 * Navegación espacial con mando a distancia (webOS).
 * Gestiona el foco entre elementos según la pantalla activa.
 *
 * Key codes (webOS Magic Remote):
 *   37 = LEFT, 38 = UP, 39 = RIGHT, 40 = DOWN
 *   13 = OK / ENTER
 *   461 = BACK
 *   415 = PLAY, 19 = PAUSE
 */
(function(global) {
  'use strict';

  const KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    ENTER: 13, BACK: 461, ESC: 27,
    PLAY: 415, PAUSE: 19, STOP: 413
  };

  let currentScreen = 'splash';
  let focusedIdx = 0;
  let focusables = []; // [{el, group, col, row}]
  const handlers = {}; // screen -> {onEnter, onBack, custom(key)}

  function log(...args) {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG) console.log('[nav]', ...args);
  }

  function clearFocus() {
    focusables.forEach(f => f.el && f.el.classList.remove('focused'));
  }

  function applyFocus() {
    clearFocus();
    const f = focusables[focusedIdx];
    if (f && f.el) {
      f.el.classList.add('focused');
      scrollIntoView(f.el);
    }
  }

  function scrollIntoView(el) {
    // Para grillas horizontales: desplazar el row-items para centrar el card.
    const row = el.closest('.row-items');
    if (row) {
      const card = el;
      const rowRect = row.parentElement.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const currentTranslate = getTranslateX(row);
      const target = currentTranslate + (rowRect.left + 80 - cardRect.left);
      row.style.transform = `translateX(${target}px)`;
    }
    // Scroll vertical del contenedor categories si el card quedó fuera de vista.
    const rowEl = el.closest('.row');
    if (rowEl) {
      const categories = document.getElementById('categories');
      const rowRect = rowEl.getBoundingClientRect();
      const viewH = window.innerHeight;
      const currentY = getTranslateY(categories);
      if (rowRect.top < 200) {
        const delta = 200 - rowRect.top;
        categories.style.transform = `translateY(${currentY + delta}px)`;
      } else if (rowRect.bottom > viewH - 100) {
        const delta = rowRect.bottom - (viewH - 100);
        categories.style.transform = `translateY(${currentY - delta}px)`;
      }
    }
  }

  function getTranslateX(el) {
    const m = (el.style.transform || '').match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }
  function getTranslateY(el) {
    const m = (el.style.transform || '').match(/translateY\((-?\d+(?:\.\d+)?)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  /**
   * Setea la lista de focusables para la pantalla actual.
   * items: array de { el, group, col, row }
   *   - group: nombre del grupo (ej: "hero", "category-0", "category-1")
   *   - col: índice dentro del grupo horizontal
   *   - row: índice de la fila (para moverse up/down entre grupos)
   */
  function setFocusables(items, initialIdx) {
    focusables = items || [];
    focusedIdx = typeof initialIdx === 'number' ? initialIdx : 0;
    applyFocus();
  }

  function findByGroupCol(group, col) {
    return focusables.findIndex(f => f.group === group && f.col === col);
  }

  function findInRow(row) {
    return focusables.findIndex(f => f.row === row);
  }

  function handleArrow(dir) {
    const cur = focusables[focusedIdx];
    if (!cur) return;

    if (dir === KEY.LEFT || dir === KEY.RIGHT) {
      // Mover en mismo grupo horizontal
      const delta = dir === KEY.RIGHT ? 1 : -1;
      const target = focusables.findIndex(f =>
        f.group === cur.group && f.col === cur.col + delta
      );
      if (target >= 0) { focusedIdx = target; applyFocus(); }
      return;
    }

    if (dir === KEY.UP || dir === KEY.DOWN) {
      const delta = dir === KEY.DOWN ? 1 : -1;
      const targetRow = cur.row + delta;
      // Buscar en la fila destino el ítem más cercano en columna.
      const rowItems = focusables
        .map((f, i) => ({ f, i }))
        .filter(x => x.f.row === targetRow);
      if (rowItems.length === 0) return;
      // Match column mejor: si hay grupo del mismo nombre, prioriza
      let best = rowItems[0];
      let bestScore = Infinity;
      rowItems.forEach(x => {
        const score = Math.abs(x.f.col - cur.col) + (x.f.group === cur.group ? -100 : 0);
        if (score < bestScore) { bestScore = score; best = x; }
      });
      focusedIdx = best.i;
      applyFocus();
    }
  }

  function onKey(e) {
    const k = e.keyCode;
    const screenHandler = handlers[currentScreen] || {};

    // Dar oportunidad al handler custom de la pantalla (ej: player)
    if (screenHandler.custom && screenHandler.custom(k, e) === true) {
      e.preventDefault();
      return;
    }

    if (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.UP || k === KEY.DOWN) {
      handleArrow(k);
      e.preventDefault();
      return;
    }
    if (k === KEY.ENTER) {
      const f = focusables[focusedIdx];
      if (f && screenHandler.onEnter) screenHandler.onEnter(f);
      e.preventDefault();
      return;
    }
    if (k === KEY.BACK || k === KEY.ESC) {
      if (screenHandler.onBack) screenHandler.onBack();
      e.preventDefault();
      return;
    }
  }

  function setScreen(name) {
    log('screen ->', name);
    currentScreen = name;
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(name);
    if (el) el.classList.add('active');
  }

  function registerScreen(name, h) {
    handlers[name] = h || {};
  }

  function getCurrentScreen() { return currentScreen; }
  function getFocused() { return focusables[focusedIdx]; }

  document.addEventListener('keydown', onKey);

  global.Nav = {
    KEY: KEY,
    setScreen: setScreen,
    registerScreen: registerScreen,
    setFocusables: setFocusables,
    getCurrentScreen: getCurrentScreen,
    getFocused: getFocused,
    applyFocus: applyFocus
  };
})(window);
