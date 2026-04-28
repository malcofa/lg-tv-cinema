/**
 * Orquesta todo: carga catálogo, maneja transiciones entre pantallas.
 * Compatible Chromium 38+ (ES5).
 */
(function(global) {
  'use strict';

  var catalog = null;

  function log() {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG && console && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[app]');
      console.log.apply(console, args);
    }
  }

  function init() {
    log('init');
    registerScreens();
    loadCatalog(false);
  }

  function loadCatalog(forceRefresh) {
    var statusEl = document.getElementById('splash-status');
    if (global.Nav.getCurrentScreen() === 'splash') {
      statusEl.textContent = forceRefresh ? 'Actualizando…' : 'Cargando catálogo…';
    }
    global.Catalog.load({ forceRefresh: forceRefresh })
      .then(function(data) {
        catalog = data;
        if ((data.movies || []).length === 0) {
          statusEl.textContent = 'Catálogo vacío. Agregá películas al Gist.';
          return;
        }
        goHome();
      })
      ['catch'](function(err) {
        log('error cargando catálogo', err);
        statusEl.textContent = 'No se pudo cargar el catálogo: ' + err.message;
      });
  }

  function findHeroPlayIdx(items) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].group === 'hero' && items[i].col === 0) return i;
    }
    return 0;
  }

  function goHome() {
    global.UI.renderHome(catalog);
    global.Nav.setScreen('home');
    var items = global.UI.buildHomeFocusables();
    global.Nav.setFocusables(items, findHeroPlayIdx(items));
  }

  function goDetail(movie) {
    if (!movie) return;
    global.UI.renderDetail(movie);
    global.Nav.setScreen('detail');
    var items = global.UI.buildDetailFocusables();
    var idx = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].el.getAttribute('data-nav') === 'detail-play') { idx = i; break; }
    }
    global.Nav.setFocusables(items, idx);
  }

  function goPlayer(movie) {
    if (!movie) return;
    global.UI.stopHeroRotation();
    global.Nav.setScreen('player');
    global.Player.play(movie, function() {
      goHome();
    });
    // Player sin focusables: todas las teclas las maneja Player.handleKey
    global.Nav.setFocusables([]);
  }

  function registerScreens() {
    // HOME
    global.Nav.registerScreen('home', {
      onEnter: function(f) {
        if (!f || !f.el) return;
        var nav = f.el.getAttribute('data-nav');
        if (nav === 'refresh') {
          global.UI.showToast('Actualizando catálogo...', 2000);
          loadCatalog(true);
          return;
        }
        if (nav === 'hero-play') {
          var m1 = global.UI.getHeroMovie();
          if (m1) goPlayer(m1);
          return;
        }
        if (nav === 'hero-info') {
          var m2 = global.UI.getHeroMovie();
          if (m2) goDetail(m2);
          return;
        }
        // Card de película
        var mid = f.el.getAttribute('data-movie-id');
        if (mid) {
          var m3 = global.UI.findMovieById(mid);
          if (m3) goDetail(m3);
        }
      },
      onBack: function() {
        // En home, BACK no hace nada
      }
    });

    // DETAIL
    global.Nav.registerScreen('detail', {
      onEnter: function(f) {
        if (!f || !f.el) return;
        var nav = f.el.getAttribute('data-nav');
        if (nav === 'detail-back') { goHome(); return; }
        if (nav === 'detail-play') {
          var mid = document.getElementById('detail').getAttribute('data-movie-id');
          var m = global.UI.findMovieById(mid);
          if (m) goPlayer(m);
        }
      },
      onBack: function() { goHome(); }
    });

    // PLAYER — todas las teclas las maneja Player.handleKey
    global.Nav.registerScreen('player', {
      custom: function(k) { return global.Player.handleKey(k); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && global.Nav.getCurrentScreen() === 'home') {
      log('visible again, silent refresh');
      global.Catalog.load({ forceRefresh: false })
        .then(function(data) {
          catalog = data;
          global.UI.renderHome(catalog);
          global.Nav.setFocusables(global.UI.buildHomeFocusables(), 0);
        })
        ['catch'](function() {});
    }
  });
})(window);
