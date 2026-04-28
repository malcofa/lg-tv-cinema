/**
 * Gestión del catálogo: fetch remoto + cache en localStorage.
 * Compatible Chromium 38+ (ES5).
 */
(function(global) {
  'use strict';

  var CACHE_KEY = 'cinema_catalog_cache_v1';
  var CACHE_TS_KEY = 'cinema_catalog_ts_v1';

  function log() {
    if (global.APP_CONFIG && global.APP_CONFIG.DEBUG && console && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[catalog]');
      console.log.apply(console, args);
    }
  }

  function now() { return new Date().getTime(); }

  function cacheIsFresh() {
    var ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10);
    var ttlMs = (global.APP_CONFIG.CACHE_TTL_MINUTES || 5) * 60 * 1000;
    return ts && (now() - ts) < ttlMs;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
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
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      var timer = setTimeout(function() {
        xhr.abort();
        reject(new Error('Timeout al cargar catálogo'));
      }, timeoutMs);
      var bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + new Date().getTime();
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
    if (!Object.prototype.toString.call(catalog.movies) === '[object Array]' && !catalog.movies.length) {
      throw new Error('catalog.movies no es array');
    }
    var clean = [];
    for (var i = 0; i < catalog.movies.length; i++) {
      var m = catalog.movies[i];
      if (m && m.id && m.title && m.video_url) clean.push(m);
    }
    catalog.movies = clean;
    return catalog;
  }

  function load(opts) {
    opts = opts || {};
    var forceRefresh = !!opts.forceRefresh;
    var url = global.APP_CONFIG.CATALOG_URL;
    var timeoutMs = global.APP_CONFIG.FETCH_TIMEOUT_MS || 10000;
    var cached = readCache();

    if (!forceRefresh && cached && cacheIsFresh()) {
      log('cache hit (fresco)');
      fetchWithTimeout(url, timeoutMs)
        .then(validate)
        .then(writeCache)
        ['catch'](function(e) { log('bg refresh falló', e.message); });
      return Promise.resolve(cached);
    }

    log('fetch', url);
    return fetchWithTimeout(url, timeoutMs)
      .then(validate)
      .then(function(data) {
        writeCache(data);
        return data;
      })
      ['catch'](function(err) {
        if (cached) {
          log('fetch falló, usando cache viejo:', err.message);
          return cached;
        }
        throw err;
      });
  }

  function groupByCategory(movies) {
    var map = {};
    for (var i = 0; i < movies.length; i++) {
      var m = movies[i];
      var cat = m.category || 'Sin categoría';
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    }
    return map;
  }

  function featured(movies) {
    var f = [];
    for (var i = 0; i < movies.length; i++) {
      if (movies[i].featured) f.push(movies[i]);
    }
    return f.length > 0 ? f : movies.slice(0, Math.min(5, movies.length));
  }

  global.Catalog = {
    load: load,
    groupByCategory: groupByCategory,
    featured: featured
  };
})(window);
