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
    try { iframe.src = 'about:blank'; } catch (e2) {}
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
