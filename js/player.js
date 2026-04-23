/**
 * Player simple con soporte opcional para HLS (.m3u8) vía hls.js desde CDN.
 */
(function(global) {
  'use strict';

  const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.14/dist/hls.min.js';
  let hlsLoaded = false;
  let hls = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  function isHLS(url) {
    return /\.m3u8(\?|$)/i.test(url);
  }

  async function setupHLS(video, url) {
    if (!hlsLoaded) {
      await loadScript(HLS_CDN);
      hlsLoaded = true;
    }
    if (window.Hls && window.Hls.isSupported()) {
      if (hls) { hls.destroy(); hls = null; }
      hls = new window.Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      return true;
    }
    // Safari soporta HLS nativo
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return true;
    }
    throw new Error('HLS no soportado por este navegador');
  }

  async function play(url) {
    const video = document.getElementById('player-video');
    try {
      if (hls) { hls.destroy(); hls = null; }
      if (isHLS(url)) {
        await setupHLS(video, url);
      } else {
        video.src = url;
      }
      video.load();
      const p = video.play();
      if (p && p.catch) {
        // Autoplay puede ser bloqueado — el usuario pulsará play manualmente
        p.catch(() => {});
      }
      return true;
    } catch (e) {
      throw e;
    }
  }

  function stop() {
    const video = document.getElementById('player-video');
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    if (hls) { try { hls.destroy(); } catch(e) {} hls = null; }
  }

  global.WebPlayer = { play, stop };
})(window);
