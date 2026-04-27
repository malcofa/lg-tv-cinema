/**
 * Navegación espacial con mando + soporte de mouse.
 * Compatible con Chromium 38+ (ES5: var, function expressions, sin template literals).
 *
 * Key codes (webOS):
 *   37=LEFT, 38=UP, 39=RIGHT, 40=DOWN, 13=OK, 461=BACK
 *   415=PLAY, 19=PAUSE, 413=STOP
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
  var focusables = []; // [{el, group, col, row}]
  var handlers = {};   // screen -> {onEnter, onBack, custom(key)}

  function log() {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[nav]');
      if (console && console.log) console.log.apply(console, args);
    }
  }

  function clearFocus() {
    for (var i = 0; i < focusables.length; i++) {
      var f = focusables[i];
      if (f && f.el) f.el.classList.remove('focused');
    }
  }

  function applyFocus() {
    clearFocus();
    var f = focusables[focusedIdx];
    if (f && f.el) {
      f.el.classList.add('focused');
      scrollIntoView(f.el);
    }
  }

  function closestEl(el, selector) {
    while (el && el !== document) {
      if (el.matches && el.matches(selector)) return el;
      // Fallback for old browsers without matches()
      if (el.msMatchesSelector && el.msMatchesSelector(selector)) return el;
      if (el.webkitMatchesSelector && el.webkitMatchesSelector(selector)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function scrollIntoView(el) {
    var row = closestEl(el, '.row-items');
    if (row) {
      var card = el;
      var rowRect = row.parentElement.getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      var currentTranslate = getTranslateX(row);
      var target = currentTranslate + (rowRect.left + 80 - cardRect.left);
      row.style.transform = 'translateX(' + target + 'px)';
    }
    var rowEl = closestEl(el, '.row');
    if (rowEl) {
      var categories = document.getElementById('categories');
      var rowRect2 = rowEl.getBoundingClientRect();
      var viewH = window.innerHeight;
      var currentY = getTranslateY(categories);
      if (rowRect2.top < 200) {
        var delta = 200 - rowRect2.top;
        categories.style.transform = 'translateY(' + (currentY + delta) + 'px)';
      } else if (rowRect2.bottom > viewH - 100) {
        var delta2 = rowRect2.bottom - (viewH - 100);
        categories.style.transform = 'translateY(' + (currentY - delta2) + 'px)';
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

  function setFocusables(items, initialIdx) {
    focusables = items || [];
    focusedIdx = typeof initialIdx === 'number' ? initialIdx : 0;
    applyFocus();
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
    var screenHandler = handlers[currentScreen] || {};
    var f = focusables[focusedIdx];
    if (f && screenHandler.onEnter) screenHandler.onEnter(f);
  }

  function onKey(e) {
    var k = e.keyCode;
    var screenHandler = handlers[currentScreen] || {};

    if (screenHandler.custom && screenHandler.custom(k, e) === true) {
      if (e.preventDefault) e.preventDefault();
      return;
    }

    if (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.UP || k === KEY.DOWN) {
      handleArrow(k);
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (k === KEY.ENTER) {
      fireEnter();
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (k === KEY.BACK || k === KEY.ESC) {
      if (screenHandler.onBack) screenHandler.onBack();
      if (e.preventDefault) e.preventDefault();
      return;
    }
  }

  /**
   * Click global: dispara el mismo onEnter que las flechas + OK.
   * Permite controlar la app con mouse, touchpad, o cursor del Magic Remote.
   */
  function onClick(e) {
    var target = e.target;
    // Buscar el elemento focusable más cercano
    while (target && target !== document.body) {
      for (var i = 0; i < focusables.length; i++) {
        if (focusables[i].el === target) {
          focusedIdx = i;
          applyFocus();
          fireEnter();
          if (e.preventDefault) e.preventDefault();
          return;
        }
      }
      target = target.parentNode;
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
  document.addEventListener('click', onClick, false);

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
