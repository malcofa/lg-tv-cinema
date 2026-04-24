/**
 * Cinema Premium — Smart TV web
 * Un solo bundle con: catalog, hero, cards, modal, player, translate, admin, spatial nav.
 *
 * Diseñado para el navegador de LG webOS TV (viewport 1280×654 CSS).
 * Admite mouse (Magic Remote o celular-como-mouse) y flechas del mando.
 */
(function() {
  'use strict';

  /* =========================================================
     CONFIG
  ========================================================= */
  const CATALOG_URL = 'https://gist.githubusercontent.com/malcofa/b74171318151c72fd3be5941e28716d2/raw/catalog.json';
  const CACHE_KEY = 'cinema_tv_cache_v1';
  const CACHE_TS_KEY = 'cinema_tv_cache_ts_v1';
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const HERO_ROTATION_MS = 9000;
  const TRANSLATE_CACHE_KEY = 'cinema_tv_translate_cache_v1';
  const ADMIN_SETTINGS_KEY = 'cinema_admin_settings_v1';
  const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.14/dist/hls.min.js';

  /* =========================================================
     UTILS
  ========================================================= */
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cssUrl = s => String(s == null ? '' : s).replace(/[\\"]/g, '\\$&');
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('visible'), ms || 3000);
  }

  /* =========================================================
     STATE
  ========================================================= */
  const state = {
    catalog: null,
    heroList: [],
    heroIdx: 0,
    heroTimer: null,
    currentMovie: null,
    scrollY: 0
  };

  /* =========================================================
     CATALOG — fetch con cache local
  ========================================================= */
  function fetchJSON(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { ctrl.abort(); reject(new Error('Timeout')); }, timeoutMs || 10000);
      const bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      fetch(url + bust, { signal: ctrl.signal, cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => { clearTimeout(timer); resolve(d); })
        .catch(e => { clearTimeout(timer); reject(e); });
    });
  }
  function readCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10);
      if (!data || !ts) return null;
      return { data, fresh: (Date.now() - ts) < CACHE_TTL_MS };
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch (e) {}
  }
  function validate(cat) {
    if (!cat || typeof cat !== 'object') throw new Error('Catálogo inválido');
    cat.movies = (cat.movies || []).filter(m => m && m.id && m.title && m.video_url);
    cat.categories = cat.categories || [];
    return cat;
  }
  async function loadCatalog(forceRefresh) {
    const cached = readCache();
    if (!forceRefresh && cached && cached.fresh) {
      fetchJSON(CATALOG_URL).then(validate).then(writeCache).catch(() => {});
      return cached.data;
    }
    try {
      const data = validate(await fetchJSON(CATALOG_URL));
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
  function featuredList(movies) {
    const f = movies.filter(m => m.featured);
    return f.length ? f : movies.slice(0, Math.min(5, movies.length));
  }
  function recentList(movies, n) {
    return [...movies]
      .sort((a, b) => String(b.added_at || '').localeCompare(String(a.added_at || '')))
      .slice(0, n || 12);
  }
  function searchMovies(movies, q) {
    const query = (q || '').toLowerCase().trim();
    if (!query) return [];
    return movies.filter(m => {
      const hay = [m.title, m.original_title, m.director, m.synopsis, m.year, m.category, (m.genres || []).join(' '), m.country]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(query) >= 0;
    });
  }

  /* =========================================================
     ADMIN MODE — credenciales en localStorage compartido con /admin/
  ========================================================= */
  const AdminMode = (() => {
    function getCreds() {
      try {
        const s = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || '{}');
        if (s && s.pat && s.gist) return s;
      } catch (e) {}
      return null;
    }
    function isEnabled() { return getCreds() !== null; }

    async function fetchGist(creds) {
      const r = await fetch(`https://api.github.com/gists/${creds.gist}`, {
        headers: {
          'Authorization': 'Bearer ' + creds.pat,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (!r.ok) throw new Error('Leer Gist (' + r.status + ')');
      const gist = await r.json();
      const files = gist.files || {};
      const fname = Object.keys(files).find(k => k.endsWith('.json')) || Object.keys(files)[0];
      if (!fname) throw new Error('Gist sin archivos');
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
      if (!r.ok) throw new Error('Guardar Gist (' + r.status + ')');
    }

    function patchLocalCache(movieId, mutator) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        const m = (d.movies || []).find(x => x.id === movieId);
        if (m) { mutator(m); localStorage.setItem(CACHE_KEY, JSON.stringify(d)); }
      } catch (e) {}
    }

    async function toggleFeatured(movieId, newValue) {
      const creds = getCreds();
      if (!creds) throw new Error('No hay credenciales');
      const { fname, catalog } = await fetchGist(creds);
      const idx = (catalog.movies || []).findIndex(m => m.id === movieId);
      if (idx < 0) throw new Error('Película no encontrada');
      if (newValue) catalog.movies[idx].featured = true;
      else delete catalog.movies[idx].featured;
      catalog.updated_at = new Date().toISOString();
      await saveGist(creds, fname, catalog);
      patchLocalCache(movieId, m => {
        if (newValue) m.featured = true;
        else delete m.featured;
      });
    }

    return { isEnabled, toggleFeatured };
  })();

  /* =========================================================
     TRANSLATE — auto-traducir sinopsis EN → ES
  ========================================================= */
  const Translate = (() => {
    const MEM_CACHE = new Map();
    const MAX_ENTRIES = 500;

    function tcLoad() {
      try { return JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY) || '{}'); } catch (e) { return {}; }
    }
    function tcSave(cache) {
      try {
        const keys = Object.keys(cache);
        if (keys.length > MAX_ENTRIES) {
          keys.sort((a, b) => (cache[a]._t || 0) - (cache[b]._t || 0));
          while (Object.keys(cache).length > MAX_ENTRIES) delete cache[keys.shift()];
        }
        localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(cache));
      } catch (e) {}
    }

    function looksEnglish(text) {
      if (!text) return false;
      if (/[ñÑáéíóúÁÉÍÓÚüÜ¿¡]/.test(text)) return false;
      const words = text.toLowerCase().split(/\s+/).slice(0, 50);
      const markers = ['the','and','of','a','is','to','in','that','for','his','her','with','on','at',
                       'by','from','are','was','be','but','has','have','this','who','an','he','she',
                       'they','when','which','their','will','been','were','would','after','about'];
      let count = 0;
      for (const w of words) {
        const clean = w.replace(/[^a-z]/g, '');
        if (markers.indexOf(clean) >= 0) count++;
      }
      return count >= 3;
    }

    async function translate(text, from, to) {
      from = from || 'en'; to = to || 'es';
      const key = from + '|' + to + '|' + text;
      if (MEM_CACHE.has(key)) return MEM_CACHE.get(key);
      const pc = tcLoad();
      if (pc[key] && pc[key].t) {
        MEM_CACHE.set(key, pc[key].t);
        return pc[key].t;
      }
      const params = new URLSearchParams({ q: text, langpair: from + '|' + to });
      const url = 'https://api.mymemory.translated.net/get?' + params.toString();
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const status = parseInt(d.responseStatus, 10);
      const out = d.responseData && d.responseData.translatedText;
      if (status !== 200 || !out) throw new Error(d.responseDetails || 'Sin traducción');
      MEM_CACHE.set(key, out);
      pc[key] = { t: out, _t: Date.now() };
      tcSave(pc);
      return out;
    }

    function openGoogleTranslate(text, from, to) {
      const url = `https://translate.google.com/?sl=${encodeURIComponent(from || 'en')}&tl=${encodeURIComponent(to || 'es')}&op=translate&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    return { looksEnglish, translate, openGoogleTranslate };
  })();

  /* =========================================================
     PLAYER — video + iframe embed
  ========================================================= */
  const Player = (() => {
    let hls = null;
    let hlsLoaded = false;

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar ' + src));
        document.head.appendChild(s);
      });
    }
    function isHLS(url) { return /\.m3u8(\?|$)/i.test(url); }
    function isEmbed(url) {
      if (!url) return false;
      if (/\.(mp4|m3u8|webm|mov|mkv|ogv|avi)(\?|$|#)/i.test(url)) return false;
      if (/\/download\//i.test(url)) return false;
      return true;
    }
    async function setupHLS(video, url) {
      if (!hlsLoaded) { await loadScript(HLS_CDN); hlsLoaded = true; }
      if (window.Hls && window.Hls.isSupported()) {
        if (hls) { hls.destroy(); hls = null; }
        hls = new window.Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        return;
      }
      if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; return; }
      throw new Error('HLS no soportado');
    }

    async function play(url) {
      const video = $('player-video');
      const iframe = $('player-iframe');
      if (isEmbed(url)) {
        stopVideo();
        video.classList.add('hidden');
        iframe.classList.remove('hidden');
        iframe.src = url;
        return;
      }
      iframe.src = 'about:blank';
      iframe.classList.add('hidden');
      video.classList.remove('hidden');
      if (hls) { hls.destroy(); hls = null; }
      if (isHLS(url)) await setupHLS(video, url);
      else video.src = url;
      video.load();
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }

    function stopVideo() {
      const video = $('player-video');
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
      if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    }

    function stop() {
      stopVideo();
      try { $('player-iframe').src = 'about:blank'; } catch (e) {}
    }

    return { play, stop, isEmbed };
  })();

  /* =========================================================
     RENDER
  ========================================================= */
  function formatMeta(m) {
    const p = [];
    if (m.year) p.push(`<span>${esc(m.year)}</span>`);
    if (m.duration_min) p.push(`<span>${m.duration_min} min</span>`);
    if (m.rating) p.push(`<span class="badge">★ ${esc(m.rating)}</span>`);
    if (m.quality) p.push(`<span class="badge">${esc(m.quality)}</span>`);
    if (m.director) p.push(`<span>· ${esc(m.director)}</span>`);
    return p.join('');
  }

  function renderHero() {
    state.heroList = featuredList(state.catalog.movies);
    state.heroIdx = 0;
    paintHero();
    renderHeroDots();
    startHeroRotation();
  }
  function paintHero() {
    const m = state.heroList[state.heroIdx];
    if (!m) return;
    const bg = m.backdrop_url || m.poster_url || '';
    $('hero-bg').style.backgroundImage = bg ? `url("${cssUrl(bg)}")` : '';
    $('hero-title').textContent = m.title || '';
    $('hero-meta').innerHTML = formatMeta(m);
    $('hero-synopsis').textContent = m.synopsis || '';
    $('hero-play').onclick = () => openPlayer(m);
    $('hero-info').onclick = () => openDetail(m);
    state.currentHero = m;
  }
  function renderHeroDots() {
    const c = $('hero-dots');
    c.innerHTML = '';
    if (state.heroList.length <= 1) return;
    state.heroList.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'hero-dot' + (i === state.heroIdx ? ' active' : '');
      d.tabIndex = 0;
      d.onclick = () => { state.heroIdx = i; paintHero(); updateDots(); restartRotation(); };
      c.appendChild(d);
    });
  }
  function updateDots() {
    [...$('hero-dots').children].forEach((d, i) => d.classList.toggle('active', i === state.heroIdx));
  }
  function startHeroRotation() {
    clearInterval(state.heroTimer);
    if (state.heroList.length <= 1) return;
    state.heroTimer = setInterval(() => {
      state.heroIdx = (state.heroIdx + 1) % state.heroList.length;
      paintHero();
      updateDots();
    }, HERO_ROTATION_MS);
  }
  function restartRotation() { startHeroRotation(); }

  function renderCategories() {
    const container = $('categories');
    container.innerHTML = '';
    const movies = state.catalog.movies;
    if (movies.length >= 4) {
      container.appendChild(renderRow('Agregadas recientemente', recentList(movies, 15)));
    }
    const byCat = groupByCategory(movies);
    const order = (state.catalog.categories || []).filter(c => byCat[c]);
    Object.keys(byCat).forEach(c => { if (order.indexOf(c) < 0) order.push(c); });
    order.forEach(cat => {
      const list = byCat[cat];
      if (list && list.length) container.appendChild(renderRow(cat, list));
    });
  }

  function renderRow(title, movies) {
    const row = document.createElement('section');
    row.className = 'row';
    row.innerHTML = `
      <h3 class="row-title">${esc(title)}</h3>
      <div class="row-items"></div>
    `;
    const items = row.querySelector('.row-items');
    movies.forEach(m => items.appendChild(renderCard(m)));
    return row;
  }

  function renderCard(m) {
    const card = document.createElement('button');
    card.className = 'card' + (m.poster_url ? '' : ' empty');
    card.tabIndex = 0;
    if (m.poster_url) {
      card.style.backgroundImage = `url("${cssUrl(m.poster_url)}")`;
    } else {
      card.textContent = '🎬';
    }

    const adminOn = AdminMode.isEnabled();
    if (adminOn) {
      card.appendChild(buildStarButton(m));
    } else if (m.featured) {
      const b = document.createElement('div');
      b.className = 'card-badge';
      b.textContent = '★';
      card.appendChild(b);
    }

    const ov = document.createElement('div');
    ov.className = 'card-overlay';
    ov.innerHTML = `
      <div class="card-title">${esc(m.title)}</div>
      <div class="card-sub">${esc([m.year, m.duration_min ? m.duration_min + ' min' : null].filter(Boolean).join(' · '))}</div>
    `;
    card.appendChild(ov);

    card.addEventListener('click', () => openDetail(m));
    return card;
  }

  function buildStarButton(m) {
    const star = document.createElement('button');
    star.className = 'card-star';
    star.type = 'button';
    star.tabIndex = 0;
    syncStar(star, !!m.featured);
    star.addEventListener('click', async e => {
      e.stopPropagation();
      e.preventDefault();
      if (star.classList.contains('saving')) return;
      const wasFeatured = !!m.featured;
      const newValue = !wasFeatured;
      star.classList.add('saving');
      syncStar(star, newValue);
      try {
        await AdminMode.toggleFeatured(m.id, newValue);
        if (newValue) m.featured = true; else delete m.featured;
        renderHero();
        toast(newValue ? '⭐ Destacada' : 'Destacada removida', 2000);
      } catch (err) {
        syncStar(star, wasFeatured);
        toast('Error: ' + err.message, 4000);
      } finally {
        star.classList.remove('saving');
      }
    });
    return star;
  }
  function syncStar(star, featured) {
    star.dataset.featured = featured ? '1' : '0';
    star.textContent = featured ? '★' : '☆';
    star.title = featured ? 'Quitar destacada' : 'Destacar';
  }

  /* =========================================================
     DETAIL MODAL
  ========================================================= */
  function openDetail(m) {
    state.currentMovie = m;
    $('modal-bg').style.backgroundImage = `url("${cssUrl(m.backdrop_url || m.poster_url || '')}")`;
    $('modal-title').textContent = m.title || '';
    $('modal-meta').innerHTML = formatMeta(m);
    $('modal-tagline').textContent = m.tagline || '';
    $('modal-synopsis').textContent = m.synopsis || '';

    const info = [];
    if (m.original_title) info.push(['Título original', m.original_title]);
    if (m.country) info.push(['País', m.country]);
    if (m.language) info.push(['Idioma', m.language]);
    if (m.subtitles && m.subtitles.length) info.push(['Subtítulos', m.subtitles.join(', ')]);
    if (m.genres && m.genres.length) info.push(['Géneros', m.genres.join(', ')]);
    if (m.category) info.push(['Categoría', m.category]);
    if (m.source) info.push(['Fuente', m.source]);
    if (m.added_by) info.push(['Agregada por', m.added_by]);
    $('modal-info').innerHTML = info.map(r =>
      `<div><strong>${esc(r[0])}:</strong> ${esc(r[1])}</div>`
    ).join('');

    $('modal-play').onclick = () => { closeDetail(); openPlayer(m); };

    wireTranslateButton(m);
    renderFeaturedButton(m);

    state.scrollY = window.scrollY;
    document.body.classList.add('modal-open');
    $('detail-modal').classList.remove('hidden');
    // Foco al botón de play
    setTimeout(() => $('modal-play').focus(), 80);
  }

  function closeDetail() {
    $('detail-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    window.scrollTo(0, state.scrollY || 0);
  }

  function renderFeaturedButton(m) {
    const actions = document.querySelector('#detail-modal .modal-actions');
    if (!actions) return;
    const old = actions.querySelector('.admin-feature-btn');
    if (old) old.remove();
    if (!AdminMode.isEnabled()) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary admin-feature-btn';
    btn.type = 'button';
    btn.tabIndex = 0;
    btn.dataset.featured = m.featured ? '1' : '0';
    updateFeatBtnLabel(btn, !!m.featured);
    btn.onclick = async () => {
      const newValue = !(btn.dataset.featured === '1');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳ Guardando';
      try {
        await AdminMode.toggleFeatured(m.id, newValue);
        if (newValue) m.featured = true; else delete m.featured;
        btn.dataset.featured = newValue ? '1' : '0';
        updateFeatBtnLabel(btn, newValue);
        renderHero();
        renderCategories();
        toast(newValue ? '⭐ Destacada' : 'Destacada removida', 2000);
      } catch (e) {
        btn.innerHTML = original;
        toast('Error: ' + e.message, 4000);
      } finally {
        btn.disabled = false;
      }
    };
    actions.appendChild(btn);
  }
  function updateFeatBtnLabel(btn, featured) {
    btn.innerHTML = featured
      ? '<span class="icon">★</span> Quitar destacada'
      : '<span class="icon">☆</span> Destacar';
  }

  function wireTranslateButton(m) {
    const btn = $('translate-btn');
    const synEl = $('modal-synopsis');
    const original = m.synopsis || '';
    btn.classList.add('hidden');
    btn.classList.remove('translated', 'loading');
    btn.onclick = null;
    if (!original.trim() || !Translate.looksEnglish(original)) return;

    btn.classList.remove('hidden');
    btn.classList.add('loading');
    btn.textContent = 'Traduciendo';

    (async () => {
      try {
        const translated = await Translate.translate(original, 'en', 'es');
        if (state.currentMovie !== m) return;
        synEl.textContent = translated;
        btn.classList.remove('loading');
        btn.classList.add('translated');
        btn.textContent = '📖 Ver original';
        let showingTranslated = true;
        btn.onclick = () => {
          showingTranslated = !showingTranslated;
          synEl.textContent = showingTranslated ? translated : original;
          btn.textContent = showingTranslated ? '📖 Ver original' : '🌐 Volver a traducida';
          btn.classList.toggle('translated', showingTranslated);
        };
      } catch (err) {
        if (state.currentMovie !== m) return;
        btn.classList.remove('loading');
        btn.classList.remove('translated');
        btn.textContent = '🌐 Traducir con Google';
        btn.onclick = () => Translate.openGoogleTranslate(original, 'en', 'es');
      }
    })();
  }

  /* =========================================================
     PLAYER CONTROL
  ========================================================= */
  async function openPlayer(m) {
    if (!m || !m.video_url) { toast('No hay URL'); return; }
    state.currentMovie = m;
    $('player-title-bar').textContent = m.title || '';
    document.body.classList.add('player-open');
    $('player-overlay').classList.remove('hidden');
    const isEmbed = Player.isEmbed(m.video_url);
    try {
      await Player.play(m.video_url);
    } catch (e) {
      toast('Error: ' + e.message, 5000);
      closePlayer();
      return;
    }
    if (!isEmbed) {
      try { await $('player-overlay').requestFullscreen(); } catch (e) {}
    }
    setTimeout(() => $('player-close').focus(), 100);
  }
  function closePlayer() {
    Player.stop();
    $('player-overlay').classList.add('hidden');
    document.body.classList.remove('player-open');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  /* =========================================================
     SEARCH
  ========================================================= */
  let searchTimer = null;
  function openSearch() {
    $('search-bar').classList.remove('hidden');
    setTimeout(() => $('search-input').focus(), 60);
  }
  function closeSearch() {
    $('search-bar').classList.add('hidden');
    $('search-input').value = '';
    $('search-results').classList.add('hidden');
    $('categories').classList.remove('hidden');
    $('hero').style.display = '';
  }
  function handleSearch() {
    const q = $('search-input').value.trim();
    if (!q) {
      $('search-results').classList.add('hidden');
      $('categories').classList.remove('hidden');
      $('hero').style.display = '';
      return;
    }
    const results = searchMovies(state.catalog.movies || [], q);
    $('categories').classList.add('hidden');
    $('hero').style.display = 'none';
    $('search-results').classList.remove('hidden');
    const grid = $('search-grid');
    grid.innerHTML = '';
    results.forEach(m => grid.appendChild(renderCard(m)));
    $('empty-search').classList.toggle('hidden', results.length > 0);
  }

  /* =========================================================
     SPATIAL NAVIGATION (flechas del mando)
     Simple: encuentra el focusable más cercano geográficamente
     en la dirección indicada y le hace .focus() nativo.
  ========================================================= */
  function isFocusable(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.offsetParent === null) return false; // oculto
    if (el.classList.contains('hidden')) return false;
    return true;
  }

  function getAllFocusables() {
    // Solo elementos VISIBLES y con tabindex o botones/inputs nativos
    const selector = 'button, input, [tabindex="0"]';
    return Array.from(document.querySelectorAll(selector)).filter(isFocusable);
  }

  function moveFocus(dir) {
    const current = document.activeElement;
    const all = getAllFocusables();
    if (all.length === 0) return;
    if (!current || !all.includes(current)) {
      all[0].focus();
      return;
    }
    const cr = current.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    let best = null, bestScore = Infinity;
    const GAP = 8;
    for (const el of all) {
      if (el === current) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      let primary, secondary;
      if (dir === 'left') {
        if (x >= cx - GAP) continue;
        primary = cx - x; secondary = Math.abs(y - cy);
      } else if (dir === 'right') {
        if (x <= cx + GAP) continue;
        primary = x - cx; secondary = Math.abs(y - cy);
      } else if (dir === 'up') {
        if (y >= cy - GAP) continue;
        primary = cy - y; secondary = Math.abs(x - cx);
      } else if (dir === 'down') {
        if (y <= cy + GAP) continue;
        primary = y - cy; secondary = Math.abs(x - cx);
      }
      const score = primary + secondary * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      best.focus();
      scrollFocusedIntoView(best);
    }
  }

  function scrollFocusedIntoView(el) {
    const row = el.closest('.row-items');
    if (row) {
      const r = el.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const pad = 50;
      if (r.right > rr.right - pad) {
        try { row.scrollBy({ left: r.right - rr.right + pad + 40, behavior: 'smooth' }); }
        catch (e) { row.scrollLeft += r.right - rr.right + pad + 40; }
      } else if (r.left < rr.left + pad) {
        try { row.scrollBy({ left: r.left - rr.left - pad - 40, behavior: 'smooth' }); }
        catch (e) { row.scrollLeft += r.left - rr.left - pad - 40; }
      }
    }
    const r = el.getBoundingClientRect();
    const h = window.innerHeight;
    const topPad = 100, botPad = 60;
    if (r.top < topPad) {
      try { window.scrollBy({ top: r.top - topPad, behavior: 'smooth' }); }
      catch (e) { window.scrollBy(0, r.top - topPad); }
    } else if (r.bottom > h - botPad) {
      try { window.scrollBy({ top: r.bottom - h + botPad, behavior: 'smooth' }); }
      catch (e) { window.scrollBy(0, r.bottom - h + botPad); }
    }
  }

  function keyDir(e) {
    const k = e.keyCode, key = e.key;
    if (k === 37 || key === 'ArrowLeft') return 'left';
    if (k === 38 || key === 'ArrowUp') return 'up';
    if (k === 39 || key === 'ArrowRight') return 'right';
    if (k === 40 || key === 'ArrowDown') return 'down';
    return null;
  }
  function isEnter(e) { return e.keyCode === 13 || e.key === 'Enter' || e.keyCode === 32 || e.key === ' '; }
  function isBack(e) {
    const k = e.keyCode, key = e.key;
    return k === 27 || k === 461 || k === 10009 || key === 'Escape' || key === 'GoBack' || key === 'BrowserBack';
  }

  function handleKey(e) {
    // Si hay modal o player abierto con Back → cerrar
    if (isBack(e)) {
      if (!$('player-overlay').classList.contains('hidden')) { e.preventDefault(); closePlayer(); return; }
      if (!$('detail-modal').classList.contains('hidden')) { e.preventDefault(); closeDetail(); return; }
      if (!$('search-bar').classList.contains('hidden')) { e.preventDefault(); closeSearch(); return; }
      return;
    }

    // Si hay un input con foco, dejar que maneje las teclas (salvo Down/Up que deben saltar)
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) {
      const dir = keyDir(e);
      if (dir === 'down' || dir === 'up') {
        a.blur();
        e.preventDefault();
        moveFocus(dir);
      }
      return;
    }

    const dir = keyDir(e);
    if (dir) {
      e.preventDefault();
      moveFocus(dir);
      return;
    }
    if (isEnter(e)) {
      const el = document.activeElement;
      if (el && el !== document.body) {
        e.preventDefault();
        el.click();
      }
    }
  }

  /* =========================================================
     BOOT
  ========================================================= */
  async function load(forceRefresh) {
    $('loading-state').classList.remove('hidden');
    $('error-state').classList.add('hidden');
    $('categories').innerHTML = '';
    $('hero').style.visibility = 'hidden';
    try {
      state.catalog = await loadCatalog(forceRefresh);
      if (!state.catalog.movies || state.catalog.movies.length === 0) {
        throw new Error('El catálogo está vacío');
      }
      $('loading-state').classList.add('hidden');
      $('hero').style.visibility = 'visible';
      renderHero();
      renderCategories();
    } catch (err) {
      $('loading-state').classList.add('hidden');
      $('error-state').classList.remove('hidden');
      $('error-message').textContent = err.message || 'Error desconocido';
    }
  }

  async function refresh() {
    toast('Actualizando…', 1500);
    try {
      state.catalog = await loadCatalog(true);
      renderHero();
      renderCategories();
      toast('Catálogo actualizado');
    } catch (e) {
      toast('No se pudo actualizar: ' + e.message);
    }
  }

  function init() {
    // Wire UI
    $('btn-refresh').onclick = refresh;
    $('btn-search').onclick = openSearch;
    $('btn-search-close').onclick = closeSearch;
    $('search-input').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(handleSearch, 200);
    });
    $('modal-close').onclick = closeDetail;
    $('detail-modal').addEventListener('click', e => {
      if (e.target === $('detail-modal')) closeDetail();
    });
    $('player-close').onclick = closePlayer;

    $('player-video').addEventListener('error', () => {
      const v = $('player-video');
      const err = v.error;
      const codes = {1:'ABORTED',2:'NETWORK',3:'DECODE',4:'SRC_NOT_SUPPORTED'};
      toast('Error reproduciendo' + (err ? ' (' + (codes[err.code] || err.code) + ')' : ''), 5000);
    });

    // Navegación por teclas: captura + window para cubrir todos los casos
    document.addEventListener('keydown', handleKey, true);
    window.addEventListener('keydown', handleKey, true);

    // Refresh cuando la TV vuelve al foreground
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.catalog) {
        loadCatalog(false).then(d => { state.catalog = d; renderHero(); renderCategories(); }).catch(() => {});
      }
    });

    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
