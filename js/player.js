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

  /**
   * Detecta si una URL es un reproductor externo (página con player embebido)
   * en vez de un archivo de video directo.
   */
  function isEmbed(url) {
    if (!url) return false;
    // Archivos de video directos conocidos
    if (/\.(mp4|m3u8|webm|mov|mkv|ogv|avi)(\?|$|#)/i.test(url)) return false;
    // Servicios directos de Internet Archive u hosting de archivos
    if (/\/download\//i.test(url)) return false;
    // Todo lo demás: asumimos que es una página de reproductor
    return true;
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
    const iframe = document.getElementById('player-iframe');

    if (isEmbed(url)) {
      // Modo embed: ocultar video, mostrar iframe
      stopVideo();
      video.classList.add('hidden');
      iframe.classList.remove('hidden');
      iframe.src = url;
      return true;
    }

    // Modo directo: ocultar iframe, usar video
    iframe.src = 'about:blank';
    iframe.classList.add('hidden');
    video.classList.remove('hidden');

    try {
      if (hls) { hls.destroy(); hls = null; }
      if (isHLS(url)) {
        await setupHLS(video, url);
      } else {
        video.src = url;
      }
      video.load();
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) {
      throw e;
    }
  }

  function stopVideo() {
    const video = document.getElementById('player-video');
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    if (hls) { try { hls.destroy(); } catch(e) {} hls = null; }
  }

  function stop() {
    stopVideo();
    const iframe = document.getElementById('player-iframe');
    try { iframe.src = 'about:blank'; } catch (e) {}
  }

  global.WebPlayer = { play, stop, isEmbed };
})(window);
