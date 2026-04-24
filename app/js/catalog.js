/**
 * Gestión del catálogo: fetch remoto + cache en localStorage.
 */
(function(global) {
  'use strict';

  const CACHE_KEY = 'cinema_catalog_cache_v1';
  const CACHE_TS_KEY = 'cinema_catalog_ts_v1';

  function log(...args) {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG) console.log('[catalog]', ...args);
  }

  function now() { return Date.now(); }

  function cacheIsFresh() {
    const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10);
    const ttlMs = (global.APP_CONFIG.CACHE_TTL_MINUTES || 5) * 60 * 1000;
    return ts && (now() - ts) < ttlMs;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      log('cache read error', e);
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TS_KEY, String(now()));
    } catch (e) {
      log('cache write error', e);
    }
  }

  function fetchWithTimeout(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const timer = setTimeout(() => {
        xhr.abort();
        reject(new Error('Timeout al cargar catálogo'));
      }, timeoutMs);
      // Cache buster para evitar que webOS/CDN sirvan una versión vieja.
      const bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      xhr.open('GET', url + bust, true);
      xhr.onload = function() {
        clearTimeout(timer);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('JSON inválido: ' + e.message));
          }
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror = function() {
        clearTimeout(timer);
        reject(new Error('Error de red'));
      };
      xhr.send();
    });
  }

  function validate(catalog) {
    if (!catalog || typeof catalog !== 'object') throw new Error('Catálogo no es objeto');
    if (!Array.isArray(catalog.movies)) throw new Error('catalog.movies no es array');
    catalog.movies = catalog.movies.filter(m => m && m.id && m.title && m.video_url);
    return catalog;
  }

  /**
   * Carga el catálogo. Estrategia:
   *  - Si hay cache fresco, devuelve cache y refresca en background.
   *  - Si no, fetchea y bloquea.
   *  - Si el fetch falla y hay cache (aunque viejo), usa el cache como fallback.
   */
  function load(opts) {
    opts = opts || {};
    const forceRefresh = !!opts.forceRefresh;
    const url = global.APP_CONFIG.CATALOG_URL;
    const timeoutMs = global.APP_CONFIG.FETCH_TIMEOUT_MS || 10000;
    const cached = readCache();

    if (!forceRefresh && cached && cacheIsFresh()) {
      log('cache hit (fresco)');
      fetchWithTimeout(url, timeoutMs)
        .then(validate)
        .then(writeCache)
        .catch(e => log('bg refresh falló', e.message));
      return Promise.resolve(cached);
    }

    log('fetch', url);
    return fetchWithTimeout(url, timeoutMs)
      .then(validate)
      .then(data => {
        writeCache(data);
        return data;
      })
      .catch(err => {
        if (cached) {
          log('fetch falló, usando cache viejo:', err.message);
          return cached;
        }
        throw err;
      });
  }

  function groupByCategory(movies) {
    const map = {};
    movies.forEach(m => {
      const cat = m.category || 'Sin categoría';
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    });
    return map;
  }

  function featured(movies) {
    const f = movies.filter(m => m.featured);
    return f.length > 0 ? f : movies.slice(0, Math.min(5, movies.length));
  }

  global.Catalog = {
    load: load,
    groupByCategory: groupByCategory,
    featured: featured
  };
})(window);
