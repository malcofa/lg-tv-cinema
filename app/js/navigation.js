/**
 * Navegación espacial con mando + soporte de mouse/cursor.
 * Compatible Chromium 38+ (ES5).
 *
 * Estrategia bulletproof:
 *  - Clicks: onclick DIRECTO en cada elemento focusable (no delegation)
 *  - Teclas: keydown global con keyCode + e.key fallback
 *  - Back: 461 (webOS), 10009 (Samsung), 27 (ESC), 'Backspace', 'GoBack'
 */
(function(global) {
  'use strict';

  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    ENTER: 13, BACK: 461, ESC: 27,
    PLAY: 415, PAUSE: 19, STOP: 413
  };

  var currentScreen = 'splash';
  var focusedIdx = 0;
  var focusables = [];
  var handlers = {};
  var lastFocusedEl = null; // Cache del último focuseado (optimización)

  function log() {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG && console && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[nav]');
      console.log.apply(console, args);
    }
  }

  function applyFocus() {
    // Optimización: solo modificamos el viejo y el nuevo (no iteramos los 50+ cards).
    if (lastFocusedEl) {
      lastFocusedEl.classList.remove('focused');
      lastFocusedEl = null;
    }
    var f = focusables[focusedIdx];
    if (f && f.el) {
      f.el.classList.add('focused');
      lastFocusedEl = f.el;
      scrollIntoView(f.el);
    }
  }

  function closestRow(el, sel) {
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains(sel)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function scrollIntoView(el) {
    var row = closestRow(el, 'row-items');
    if (row && row.parentElement) {
      var rowRect = row.parentElement.getBoundingClientRect();
      var cardRect = el.getBoundingClientRect();
      var currentTranslate = getTranslateX(row);
      var target = currentTranslate + (rowRect.left + 80 - cardRect.left);
      row.style.transform = 'translateX(' + target + 'px)';
    }
    var rowEl = closestRow(el, 'row');
    if (rowEl) {
      var categories = document.getElementById('categories');
      if (!categories) return;
      var rowRect2 = rowEl.getBoundingClientRect();
      var viewH = window.innerHeight;
      var currentY = getTranslateY(categories);
      if (rowRect2.top < 200) {
        categories.style.transform = 'translateY(' + (currentY + (200 - rowRect2.top)) + 'px)';
      } else if (rowRect2.bottom > viewH - 100) {
        categories.style.transform = 'translateY(' + (currentY - (rowRect2.bottom - (viewH - 100))) + 'px)';
      }
    }
  }

  function getTranslateX(el) {
    var m = (el.style.transform || '').match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }
  function getTranslateY(el) {
    var m = (el.style.transform || '').match(/translateY\((-?\d+(?:\.\d+)?)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  /**
   * Setea focusables y adjunta onclick DIRECTO en cada uno.
   * Esto garantiza que los clicks de mouse/cursor funcionen sin
   * depender de delegation ni de pasarse por capture phase.
   */
  function setFocusables(items, initialIdx) {
    // Limpiar onclicks previos para liberar referencias (RAM)
    for (var j = 0; j < focusables.length; j++) {
      var prev = focusables[j];
      if (prev && prev.el && prev.el.__navClick) {
        prev.el.onclick = null;
        prev.el.__navClick = null;
      }
    }
    // Limpiar último foco si pertenece al set anterior
    if (lastFocusedEl) {
      lastFocusedEl.classList.remove('focused');
      lastFocusedEl = null;
    }
    focusables = items || [];
    focusedIdx = typeof initialIdx === 'number' ? initialIdx : 0;

    // Adjuntar onclick directo a cada focusable
    for (var i = 0; i < focusables.length; i++) {
      var f = focusables[i];
      if (f && f.el) {
        f.el.onclick = makeClickHandler(i);
        f.el.__navClick = true;
      }
    }
    applyFocus();
  }

  function makeClickHandler(idx) {
    return function(e) {
      focusedIdx = idx;
      applyFocus();
      fireEnter();
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();
      return false;
    };
  }

  function handleArrow(dir) {
    var cur = focusables[focusedIdx];
    if (!cur) return;
    if (dir === KEY.LEFT || dir === KEY.RIGHT) {
      var delta = dir === KEY.RIGHT ? 1 : -1;
      var target = -1;
      for (var i = 0; i < focusables.length; i++) {
        if (focusables[i].group === cur.group && focusables[i].col === cur.col + delta) {
          target = i; break;
        }
      }
      if (target >= 0) { focusedIdx = target; applyFocus(); }
      return;
    }
    if (dir === KEY.UP || dir === KEY.DOWN) {
      var delta2 = dir === KEY.DOWN ? 1 : -1;
      var targetRow = cur.row + delta2;
      var rowItems = [];
      for (var j = 0; j < focusables.length; j++) {
        if (focusables[j].row === targetRow) rowItems.push({ f: focusables[j], i: j });
      }
      if (rowItems.length === 0) return;
      var best = rowItems[0];
      var bestScore = Infinity;
      for (var k = 0; k < rowItems.length; k++) {
        var x = rowItems[k];
        var score = Math.abs(x.f.col - cur.col) + (x.f.group === cur.group ? -100 : 0);
        if (score < bestScore) { bestScore = score; best = x; }
      }
      focusedIdx = best.i;
      applyFocus();
    }
  }

  function fireEnter() {
    var sh = handlers[currentScreen] || {};
    var f = focusables[focusedIdx];
    if (f && sh.onEnter) sh.onEnter(f);
  }

  // Throttle para evitar que pulsaciones rápidas del mando colapsen el render.
  var lastNavTime = 0;
  var NAV_THROTTLE_MS = 90;

  function onKey(e) {
    var k = e.keyCode;
    var sh = handlers[currentScreen] || {};
    if (sh.custom && sh.custom(k, e) === true) {
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.UP || k === KEY.DOWN) {
      var now = (new Date()).getTime();
      if (now - lastNavTime < NAV_THROTTLE_MS) {
        if (e.preventDefault) e.preventDefault();
        return;
      }
      lastNavTime = now;
      handleArrow(k);
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (k === KEY.ENTER) {
      fireEnter();
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (k === KEY.BACK || k === KEY.ESC || k === 10009 || k === 8) {
      if (sh.onBack) sh.onBack();
      if (e.preventDefault) e.preventDefault();
      return;
    }
  }

  function setScreen(name) {
    log('screen ->', name);
    currentScreen = name;
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    var el = document.getElementById(name);
    if (el) el.classList.add('active');
  }

  function registerScreen(name, h) {
    handlers[name] = h || {};
  }

  function getCurrentScreen() { return currentScreen; }
  function getFocused() { return focusables[focusedIdx]; }

  document.addEventListener('keydown', onKey, false);

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
