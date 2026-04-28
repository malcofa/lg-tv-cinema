/**
 * Player de TV webOS.
 * Soporta dos modos:
 *  - Video directo (MP4, HLS) con <video> HTML5
 *  - Embed externo (iframe) para reproductores de terceros
 * Compatible Chromium 38+ (ES5).
 *
 * NOTA: el botón "Volver" fue eliminado. Para salir:
 *  - Modo direct: tecla Back del mando (461)
 *  - Modo embed: tecla Back del mando — si el iframe captura el foco, se sale
 *    apagando la TV y volviendo, o usando el mouse para clickear fuera.
 */
(function(global) {
  'use strict';

  var video = document.getElementById('video');
  var iframe = document.getElementById('video-iframe');
  var overlay = document.getElementById('player-overlay');
  var titleEl = document.getElementById('player-title');
  var overlayTimer = null;
  var currentMovie = null;
  var onExitCb = null;
  var mode = 'direct'; // 'direct' | 'embed'

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
    overlayTimer = setTimeout(function() { overlay.classList.remove('visible'); }, 3000);
  }

  function isEmbed(url) {
    if (!url) return false;
    if (/\.(mp4|m3u8|webm|mov|mkv|ogv|avi)(\?|$|#)/i.test(url)) return false;
    if (/\/download\//i.test(url)) return false;
    return true;
  }

  function focusIframe() {
    try { iframe.focus(); } catch (e) {}
    try { if (iframe.contentWindow) iframe.contentWindow.focus(); } catch (e) {}
  }

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

      // Estrategia: usar contentWindow.location.replace cuando sea posible
      // (evita acumular history entries del iframe). Si el iframe ya navegó
      // a un origen externo (cross-origin), location.replace falla, así que
      // caemos al src directo.
      var loadUrl = function() {
        try {
          if (iframe.contentWindow && iframe.contentDocument) {
            // contentDocument acceso → todavía same-origin (about:blank)
            iframe.contentWindow.location.replace(movie.video_url);
            return;
          }
        } catch (e) { /* cross-origin, fallback */ }
        iframe.src = movie.video_url;
      };

      // Reset a about:blank primero si veníamos de otro embed cross-origin.
      // Esto restaura el contentWindow accesible para usar location.replace.
      var currentSrc = iframe.getAttribute('src') || '';
      if (currentSrc && currentSrc !== 'about:blank') {
        iframe.onload = function() {
          iframe.onload = null;
          loadUrl();
          iframe.onload = function() {
            focusIframe();
            setTimeout(focusIframe, 200);
            setTimeout(focusIframe, 500);
            setTimeout(focusIframe, 1000);
          };
        };
        iframe.src = 'about:blank';
      } else {
        loadUrl();
        iframe.onload = function() {
          focusIframe();
          setTimeout(focusIframe, 200);
          setTimeout(focusIframe, 500);
          setTimeout(focusIframe, 1000);
        };
      }
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
  }

  function stop() {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    // Blur iframe primero para liberar el foco DOM antes del cambio de src.
    // Sin esto, document.activeElement queda como el iframe y las teclas
    // siguen yendo a él en vez de a nuestro handler.
    try { iframe.blur(); } catch (eB) {}
    try { iframe.src = 'about:blank'; } catch (e2) {}
    try { document.body.focus(); } catch (e3) {}
    overlay.classList.remove('visible');
    if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
  }

  function togglePause() {
    if (mode === 'embed') return;
    if (video.paused) video.play(); else video.pause();
    showOverlay();
  }

  function seek(deltaSec) {
    if (mode === 'embed') return;
    try {
      var target = Math.max(0, Math.min((video.duration || 0), (video.currentTime || 0) + deltaSec));
      video.currentTime = target;
      showOverlay();
    } catch (e) {}
  }

  function handleKey(keyCode) {
    var K = global.Nav.KEY;
    if (keyCode === K.BACK || keyCode === K.ESC || keyCode === K.STOP) {
      stop();
      if (onExitCb) onExitCb();
      return true;
    }
    if (mode === 'embed') {
      // Mantener el foco en iframe, si presionó Enter/Play intentar click sintético
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

  global.Player = {
    play: play,
    stop: stop,
    handleKey: handleKey
  };
})(window);
