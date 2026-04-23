/**
 * Player de TV webOS.
 * Soporta dos modos:
 *  - Video directo (MP4, HLS, etc.) usando <video> HTML5 nativo
 *  - Embed externo (iframe) para reproductores de terceros
 *
 * webOS reproduce MP4/H.264/AAC y HLS (.m3u8) sin setup extra.
 * Iframes en webOS funcionan pero el mando solo controla la navegación
 * nuestra, no el contenido del iframe (el usuario usa los controles
 * del player externo con cursor virtual).
 */
(function(global) {
  'use strict';

  const video = document.getElementById('video');
  const iframe = document.getElementById('video-iframe');
  const overlay = document.getElementById('player-overlay');
  const titleEl = document.getElementById('player-title');
  let overlayTimer = null;
  let currentMovie = null;
  let onExitCb = null;
  let mode = 'direct'; // 'direct' | 'embed'

  function log(...a) {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG) console.log('[player]', ...a);
  }

  function showOverlay() {
    overlay.classList.add('visible');
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => overlay.classList.remove('visible'), 3000);
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
      // Iframe mode: ocultar video, mostrar iframe con el reproductor externo
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
      video.classList.add('hidden');
      iframe.classList.remove('hidden');
      iframe.src = movie.video_url;
    } else {
      // Modo directo: ocultar iframe, usar video nativo
      iframe.src = 'about:blank';
      iframe.classList.add('hidden');
      video.classList.remove('hidden');
      video.src = movie.video_url;
      video.load();
      const p = video.play();
      if (p && p.catch) p.catch(err => {
        if (global.UI) global.UI.showToast('Error al reproducir: ' + err.message);
      });
    }
    showOverlay();
  }

  function stop() {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    try { iframe.src = 'about:blank'; } catch (e) {}
    overlay.classList.remove('visible');
    if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
  }

  function togglePause() {
    if (mode === 'embed') { showOverlay(); return; }
    if (video.paused) video.play(); else video.pause();
    showOverlay();
  }

  function seek(deltaSec) {
    if (mode === 'embed') { showOverlay(); return; }
    try {
      const target = Math.max(0, Math.min((video.duration || 0), (video.currentTime || 0) + deltaSec));
      video.currentTime = target;
      showOverlay();
    } catch (e) {}
  }

  /**
   * Handler de teclas para el player. Devuelve true si la tecla fue consumida.
   * En modo embed, solo interceptamos BACK — el resto de teclas van al iframe
   * (permite que el usuario navegue con cursor virtual si lo tiene habilitado).
   */
  function handleKey(keyCode) {
    const K = global.Nav.KEY;
    if (keyCode === K.BACK || keyCode === K.ESC || keyCode === K.STOP) {
      stop();
      if (onExitCb) onExitCb();
      return true;
    }
    if (mode === 'embed') {
      // En embed dejamos pasar todas las demás teclas al iframe
      return false;
    }
    switch (keyCode) {
      case K.ENTER:
      case K.PAUSE:
      case K.PLAY:
        togglePause(); return true;
      case K.LEFT:
        seek(-10); return true;
      case K.RIGHT:
        seek(10); return true;
      case K.UP:
      case K.DOWN:
        showOverlay(); return true;
    }
    return false;
  }

  video.addEventListener('error', () => {
    const err = video.error;
    let msg = 'Error de reproducción';
    if (err) {
      const codes = {1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED'};
      msg += ' (' + (codes[err.code] || err.code) + ')';
    }
    if (global.UI) global.UI.showToast(msg + '. La URL puede no funcionar en la TV.');
  });

  global.Player = {
    play: play,
    stop: stop,
    handleKey: handleKey
  };
})(window);
