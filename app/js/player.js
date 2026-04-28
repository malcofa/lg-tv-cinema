/**
 * Player de TV webOS.
 * Soporta dos modos:
 *  - Video directo (MP4, HLS) con <video> HTML5
 *  - Embed externo (iframe) para reproductores de terceros
 * Compatible Chromium 38+ (ES5).
 */
(function(global) {
  'use strict';

  var video = document.getElementById('video');
  var iframe = document.getElementById('video-iframe');
  var overlay = document.getElementById('player-overlay');
  var titleEl = document.getElementById('player-title');
  var backBtn = document.querySelector('.player-back-fixed');
  var overlayTimer = null;
  var backBtnTimer = null;
  var currentMovie = null;
  var onExitCb = null;
  var mode = 'direct'; // 'direct' | 'embed'

  var BACK_HIDE_MS = 3000;

  function log() {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG && console && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[player]');
      console.log.apply(console, args);
    }
  }

  function showOverlay() {
    overlay.classList.add('visible');
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(function() { overlay.classList.remove('visible'); }, BACK_HIDE_MS);
  }

  /**
   * Muestra el botón "Volver". Auto-oculta tras 3s sin interacción.
   * Por defecto el botón está oculto. Solo aparece al mover el mouse o presionar
   * teclas (modo direct). En modo embed las teclas las captura el iframe, así
   * que el botón solo se muestra con mouse — pero tu mando tiene Back para salir.
   */
  function showBackBtn() {
    if (!backBtn) return;
    backBtn.classList.remove('back-hidden');
    if (backBtnTimer) clearTimeout(backBtnTimer);
    backBtnTimer = setTimeout(function() {
      if (backBtn) backBtn.classList.add('back-hidden');
    }, BACK_HIDE_MS);
  }

  function hideBackBtnImmediate() {
    if (backBtnTimer) { clearTimeout(backBtnTimer); backBtnTimer = null; }
    if (backBtn) backBtn.classList.add('back-hidden');
  }

  function resetBackBtnVisible() {
    if (backBtn) backBtn.classList.remove('back-hidden');
    if (backBtnTimer) { clearTimeout(backBtnTimer); backBtnTimer = null; }
  }

  function isEmbed(url) {
    if (!url) return false;
    if (/\.(mp4|m3u8|webm|mov|mkv|ogv|avi)(\?|$|#)/i.test(url)) return false;
    if (/\/download\//i.test(url)) return false;
    return true;
  }

  function play(movie, onExit) {
    currentMovie = movie;
    onExitCb = onExit;
    titleEl.textContent = movie.title || '';
    mode = isEmbed(movie.video_url) ? 'embed' : 'direct';
    log('play mode=' + mode, movie.video_url);

    if (mode === 'embed') {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
      video.classList.add('hidden');
      iframe.classList.remove('hidden');
      iframe.src = movie.video_url;
      // Cuando el iframe carga, le damos foco. Después intentamos refocusarlo
      // varias veces porque algunos players de TV se "comen" el primer focus.
      iframe.onload = function() {
        focusIframe();
        setTimeout(focusIframe, 200);
        setTimeout(focusIframe, 500);
        setTimeout(focusIframe, 1000);
      };
    } else {
      iframe.src = 'about:blank';
      iframe.classList.add('hidden');
      video.classList.remove('hidden');
      video.src = movie.video_url;
      video.load();
      var p = video.play();
      if (p && p['catch']) {
        p['catch'](function(err) {
          if (global.UI) global.UI.showToast('Error al reproducir: ' + (err && err.message ? err.message : err));
        });
      }
    }
    showOverlay();
    // El botón "Volver" arranca oculto. Solo aparece al mover el mouse.
    // Para salir con mando se usa la tecla Back (461) que llega via handleKey.
    if (backBtn) backBtn.classList.add('back-hidden');
  }

  function stop() {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    try { iframe.src = 'about:blank'; } catch (e2) {}
    overlay.classList.remove('visible');
    if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
    resetBackBtnVisible(); // que vuelva a estar disponible cuando el usuario reabra
  }

  function togglePause() {
    if (mode === 'embed') { showBackBtn(); return; }
    if (video.paused) video.play(); else video.pause();
    showOverlay();
    showBackBtn();
  }

  function seek(deltaSec) {
    if (mode === 'embed') { showBackBtn(); return; }
    try {
      var target = Math.max(0, Math.min((video.duration || 0), (video.currentTime || 0) + deltaSec));
      video.currentTime = target;
      showOverlay();
      showBackBtn();
    } catch (e) {}
  }

  function focusIframe() {
    try { iframe.focus(); } catch (e) {}
    try { if (iframe.contentWindow) iframe.contentWindow.focus(); } catch (e) {}
  }

  /** Intenta clickear al centro del iframe. Útil para algunos players
   *  que SÍ aceptan eventos sintéticos en su elemento contenedor. */
  function tryClickIframe() {
    try {
      var rect = iframe.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var evt = document.createEvent('MouseEvents');
      evt.initMouseEvent('click', true, true, window, 1, cx, cy, cx, cy,
        false, false, false, false, 0, null);
      iframe.dispatchEvent(evt);
    } catch (e) {}
  }

  function handleKey(keyCode) {
    var K = global.Nav.KEY;
    // Cualquier tecla muestra el botón Volver
    showBackBtn();

    if (keyCode === K.BACK || keyCode === K.ESC || keyCode === K.STOP) {
      stop();
      if (onExitCb) onExitCb();
      return true;
    }
    if (mode === 'embed') {
      // Refocus agresivo al iframe para que la próxima tecla llegue a su contenido.
      // Si presionó Enter / Play, además intentamos click sintético al iframe
      // (algunos players de terceros responden, otros no por CORS).
      focusIframe();
      if (keyCode === K.ENTER || keyCode === K.PLAY) {
        tryClickIframe();
      }
      return false;
    }
    if (keyCode === K.ENTER || keyCode === K.PAUSE || keyCode === K.PLAY) {
      togglePause(); return true;
    }
    if (keyCode === K.LEFT) { seek(-10); return true; }
    if (keyCode === K.RIGHT) { seek(10); return true; }
    if (keyCode === K.UP || keyCode === K.DOWN) { showOverlay(); return true; }
    return false;
  }

  video.addEventListener('error', function() {
    var err = video.error;
    var msg = 'Error de reproducción';
    if (err) {
      var codes = {1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED'};
      msg += ' (' + (codes[err.code] || err.code) + ')';
    }
    if (global.UI) global.UI.showToast(msg + '. La URL puede no funcionar en la TV.');
  }, false);

  // Mouse move muestra el botón también (por si el usuario tiene Magic Remote)
  document.addEventListener('mousemove', function() {
    if (global.Nav && global.Nav.getCurrentScreen() === 'player') showBackBtn();
  }, false);

  global.Player = {
    play: play,
    stop: stop,
    handleKey: handleKey,
    showBackBtn: showBackBtn
  };
})(window);
