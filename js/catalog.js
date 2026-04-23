/**
 * Cliente simple del catálogo JSON del Gist.
 * Sin cache agresivo — los usuarios ven siempre lo último.
 */
(function(global) {
  'use strict';

  const CATALOG_URL = 'https://gist.githubusercontent.com/malcofa/b74171318151c72fd3be5941e28716d2/raw/catalog.json';
  const TIMEOUT_MS = 10000;
  const CACHE_KEY = 'cinema_web_cache_v1';
  const CACHE_TS_KEY = 'cinema_web_cache_ts_v1';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

  function fetchJSON(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { ctrl.abort(); reject(new Error('Timeout')); }, timeoutMs);
      const bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      fetch(url + bust, { signal: ctrl.signal, cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(d => { clearTimeout(timer); resolve(d); })
        .catch(e => { clearTimeout(timer); reject(e); });
    });
  }

  function readCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10);
      if (!data || !ts) return null;
      return { data, ts, fresh: (Date.now() - ts) < CACHE_TTL_MS };
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch (e) {}
  }

  function validate(catalog) {
    if (!catalog || typeof catalog !== 'object') throw new Error('Formato inválido');
    catalog.movies = (catalog.movies || []).filter(m => m && m.id && m.title && m.video_url);
    catalog.categories = catalog.categories || [];
    return catalog;
  }

  /**
   * Devuelve el catálogo. Si hay cache fresco, lo usa; si no, fetchea.
   * Si el fetch falla y hay cache (aunque viejo), usa el cache.
   */
  async function load(opts) {
    opts = opts || {};
    const forceRefresh = !!opts.forceRefresh;
    const cached = readCache();

    if (!forceRefresh && cached && cached.fresh) {
      // Refresh silencioso en background
      fetchJSON(CATALOG_URL, TIMEOUT_MS).then(validate).then(writeCache).catch(() => {});
      return cached.data;
    }

    try {
      const data = validate(await fetchJSON(CATALOG_URL, TIMEOUT_MS));
      writeCache(data);
      return data;
    } catch (err) {
      if (cached) return cached.data;
      throw err;
    }
  }

  function groupByCategory(movies) {
    const map = {};
    movies.forEach(m => {
      const cat = m.category || 'Sin categoría';
      (map[cat] = map[cat] || []).push(m);
    });
    return map;
  }

  function featured(movies) {
    const f = movies.filter(m => m.featured);
    return f.length ? f : movies.slice(0, Math.min(5, movies.length));
  }

  function recent(movies, limit) {
    return [...movies]
      .sort((a, b) => String(b.added_at || '').localeCompare(String(a.added_at || '')))
      .slice(0, limit || 10);
  }

  function search(movies, query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [];
    return movies.filter(m => {
      const hay = [
        m.title, m.original_title, m.director, m.synopsis,
        m.year, m.category, (m.genres || []).join(' '), m.country
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  global.Catalog = { load, groupByCategory, featured, recent, search };
})(window);
