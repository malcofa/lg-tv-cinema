/**
 * AdminMode — detecta credenciales de admin en localStorage (compartidas con
 * /admin/ porque es el mismo origen) y permite toggles rápidos desde el
 * player público: destacar/des-destacar pelis sin salir del modal de detalle.
 *
 * Si no hay credenciales → este módulo queda inerte, los botones no aparecen.
 */
(function(global) {
  'use strict';

  const ADMIN_KEY = 'cinema_admin_settings_v1';
  const CACHE_KEY = 'cinema_web_cache_v1';
  const CACHE_TS_KEY = 'cinema_web_cache_ts_v1';

  function getCreds() {
    try {
      const s = JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}');
      if (s && s.pat && s.gist) return s;
    } catch (e) {}
    return null;
  }

  function isEnabled() { return getCreds() !== null; }

  async function fetchGistRaw(creds) {
    const r = await fetch(`https://api.github.com/gists/${creds.gist}`, {
      headers: {
        'Authorization': 'Bearer ' + creds.pat,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (!r.ok) throw new Error('No se pudo leer el Gist (' + r.status + ')');
    const gist = await r.json();
    const files = gist.files || {};
    const fname = Object.keys(files).find(k => k.endsWith('.json')) || Object.keys(files)[0];
    if (!fname) throw new Error('El Gist no tiene archivos');
    const file = files[fname];
    let content = file.content;
    if (file.truncated) {
      const r2 = await fetch(file.raw_url);
      content = await r2.text();
    }
    return { fname, catalog: JSON.parse(content) };
  }

  async function saveGist(creds, fname, catalog) {
    const body = { files: {} };
    body.files[fname] = { content: JSON.stringify(catalog, null, 2) };
    const r = await fetch(`https://api.github.com/gists/${creds.gist}`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + creds.pat,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error('No se pudo guardar (' + r.status + '): ' + t.slice(0, 120));
    }
  }

  /** Actualiza también el cache local para que refresh inmediato no vuelva al estado viejo. */
  function patchLocalCache(movieId, mutator) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const m = (d.movies || []).find(x => x.id === movieId);
      if (m) { mutator(m); localStorage.setItem(CACHE_KEY, JSON.stringify(d)); }
    } catch (e) {}
  }

  /**
   * Cambia el flag "featured" de una peli. Fetch + patch + save.
   * Devuelve el nuevo valor efectivo (true | false).
   */
  async function toggleFeatured(movieId, newValue) {
    const creds = getCreds();
    if (!creds) throw new Error('No hay credenciales de admin');
    const { fname, catalog } = await fetchGistRaw(creds);
    const idx = (catalog.movies || []).findIndex(m => m.id === movieId);
    if (idx < 0) throw new Error('No se encontró la película');
    if (newValue) catalog.movies[idx].featured = true;
    else delete catalog.movies[idx].featured;
    catalog.updated_at = new Date().toISOString();
    await saveGist(creds, fname, catalog);
    // Invalidar cache local para que el próximo refresh traiga el estado real
    patchLocalCache(movieId, m => {
      if (newValue) m.featured = true;
      else delete m.featured;
    });
    return newValue;
  }

  global.AdminMode = { isEnabled, getCreds, toggleFeatured };
})(window);
