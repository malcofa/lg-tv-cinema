/**
 * Player simple usando <video> HTML5 nativo de webOS.
 * webOS reproduce MP4/H.264/AAC y HLS (.m3u8) sin setup extra.
 */
(function(global) {
  'use strict';

  const video = document.getElementById('video');
  const overlay = document.getElementById('player-overlay');
  const titleEl = document.getElementById('player-title');
  let overlayTimer = null;
  let currentMovie = null;
  let onExitCb = null;

  function showOverlay() {
    overlay.classList.add('visible');
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => overlay.classList.remove('visible'), 3000);
  }

  function play(movie, onExit) {
    currentMovie = movie;
    onExitCb = onExit;
    titleEl.textContent = movie.title || '';
    video.src = movie.video_url;
    video.load();
    const p = video.play();
    if (p && p.catch) p.catch(err => {
      if (global.UI) global.UI.showToast('Error al reproducir: ' + err.message);
    });
    showOverlay();
  }

  function stop() {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    overlay.classList.remove('visible');
    if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
  }

  function togglePause() {
    if (video.paused) video.play(); else video.pause();
    showOverlay();
  }

  function seek(deltaSec) {
    try {
      const target = Math.max(0, Math.min((video.duration || 0), (video.currentTime || 0) + deltaSec));
      video.currentTime = target;
      showOverlay();
    } catch (e) {}
  }

  /**
   * Handler de teclas para el player. Devuelve true si la tecla fue consumida.
   */
  function handleKey(keyCode) {
    const K = global.Nav.KEY;
    switch (keyCode) {
      case K.BACK:
      case K.ESC:
      case K.STOP:
        stop();
        if (onExitCb) onExitCb();
        return true;
      case K.ENTER:
      case K.PAUSE:
      case K.PLAY:
        togglePause();
        return true;
      case K.LEFT:
        seek(-10);
        return true;
      case K.RIGHT:
        seek(10);
        return true;
      case K.UP:
      case K.DOWN:
        showOverlay();
        return true;
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
