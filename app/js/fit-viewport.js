/**
 * Auto-scale del root de 1920x1080 al viewport real de la TV.
 * webOS 4.5/5.0 puede reportar 1280x720, 1280x654, o 1920x1080 según modelo.
 * Este script calcula el factor de escala y centra el contenido.
 */
(function() {
  'use strict';

  function fit() {
    var root = document.getElementById('tv-root');
    if (!root) return;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var sx = vw / 1920;
    var sy = vh / 1080;
    var s = Math.min(sx, sy);
    var usedW = 1920 * s;
    var usedH = 1080 * s;
    var offsetX = Math.max(0, (vw - usedW) / 2);
    var offsetY = Math.max(0, (vh - usedH) / 2);
    // translate + scale en un solo transform
    root.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + s + ')';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fit);
  } else {
    fit();
  }
  window.addEventListener('resize', fit);
  // También en visibility change (webOS puede cambiar de tamaño al volver del background)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') fit();
  });
})();
