/**
 * Orquesta todo: carga catálogo, maneja transiciones entre pantallas.
 */
(function(global) {
  'use strict';

  let catalog = null;

  function log(...a) {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG) console.log('[app]', ...a);
  }

  function init() {
    log('init');
    registerScreens();
    loadCatalog(false);
  }

  function loadCatalog(forceRefresh) {
    const statusEl = document.getElementById('splash-status');
    if (global.Nav.getCurrentScreen() === 'splash') {
      statusEl.textContent = forceRefresh ? 'Actualizando…' : 'Cargando catálogo…';
    }
    global.Catalog.load({ forceRefresh: forceRefresh })
      .then(data => {
        catalog = data;
        if ((data.movies || []).length === 0) {
          statusEl.textContent = 'Catálogo vacío. Agregá películas al Gist.';
          return;
        }
        goHome();
      })
      .catch(err => {
        log('error cargando catálogo', err);
        statusEl.textContent = 'No se pudo cargar el catálogo: ' + err.message;
      });
  }

  function goHome() {
    global.UI.renderHome(catalog);
    global.Nav.setScreen('home');
    global.Nav.setFocusables(global.UI.buildHomeFocusables(),
      // Foco inicial en "Reproducir" del hero si existe
      (() => {
        const items = global.UI.buildHomeFocusables();
        const i = items.findIndex(x => x.group === 'hero' && x.col === 0);
        return i >= 0 ? i : 0;
      })()
    );
  }

  function goDetail(movie) {
    if (!movie) return;
    global.UI.renderDetail(movie);
    global.Nav.setScreen('detail');
    const items = global.UI.buildDetailFocusables();
    // Foco en "Reproducir" por defecto
    const i = items.findIndex(x => x.el.dataset.nav === 'detail-play');
    global.Nav.setFocusables(items, i >= 0 ? i : 0);
  }

  function goPlayer(movie) {
    if (!movie) return;
    global.UI.stopHeroRotation();
    global.Nav.setScreen('player');
    global.Player.play(movie, () => {
      // Al salir del player, volver a home (no al detalle, es más intuitivo con mando)
      goHome();
    });
  }

  function registerScreens() {
    // HOME
    global.Nav.registerScreen('home', {
      onEnter: (f) => {
        if (!f || !f.el) return;
        const nav = f.el.dataset.nav;
        if (nav === 'refresh') {
          global.UI.showToast('Actualizando catálogo...', 2000);
          loadCatalog(true);
          return;
        }
        if (nav === 'hero-play') {
          const m = global.UI.getHeroMovie();
          if (m) goPlayer(m);
          return;
        }
        if (nav === 'hero-info') {
          const m = global.UI.getHeroMovie();
          if (m) goDetail(m);
          return;
        }
        // Card de película
        const mid = f.el.dataset.movieId;
        if (mid) {
          const m = global.UI.findMovieById(mid);
          if (m) goDetail(m);
        }
      },
      onBack: () => {
        // En home, BACK no hace nada (o podría minimizar la app).
        // webOS maneja el exit con el botón HOME del mando.
      }
    });

    // DETAIL
    global.Nav.registerScreen('detail', {
      onEnter: (f) => {
        if (!f || !f.el) return;
        const nav = f.el.dataset.nav;
        if (nav === 'detail-back') { goHome(); return; }
        if (nav === 'detail-play') {
          const mid = document.getElementById('detail').dataset.movieId;
          const m = global.UI.findMovieById(mid);
          if (m) goPlayer(m);
        }
      },
      onBack: () => goHome()
    });

    // PLAYER — todas las teclas van al handler del player.
    global.Nav.registerScreen('player', {
      custom: (k) => global.Player.handleKey(k)
    });
  }

  // Arranque cuando carga DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Visibility: cuando la TV retoma la app, refrescar cache si está viejo
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && global.Nav.getCurrentScreen() === 'home') {
      log('visible again, silent refresh');
      global.Catalog.load({ forceRefresh: false }).then(data => {
        catalog = data;
        global.UI.renderHome(catalog);
        global.Nav.setFocusables(global.UI.buildHomeFocusables(), 0);
      }).catch(() => {});
    }
  });
})(window);
