/**
 * App principal del player web. Renderiza hero, categorías, detalle, búsqueda.
 */
(function(global) {
  'use strict';

  const state = {
    catalog: null,
    heroList: [],
    heroIdx: 0,
    heroTimer: null,
    currentMovie: null,
    scrollY: 0
  };

  // Cache en memoria de traducciones: text -> translated
  const translationCache = new Map();

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ================= TOAST ================= */
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('visible'), ms || 3000);
  }

  /* ================= LOAD / RENDER ================= */
  async function load() {
    $('loading-state').classList.remove('hidden');
    $('error-state').classList.add('hidden');
    $('categories').innerHTML = '';
    $('hero').style.visibility = 'hidden';
    try {
      state.catalog = await global.Catalog.load();
      if (!state.catalog.movies || state.catalog.movies.length === 0) {
        throw new Error('El catálogo está vacío. Pedile al admin que agregue películas.');
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
    toast('Actualizando catálogo…', 1500);
    try {
      state.catalog = await global.Catalog.load({ forceRefresh: true });
      renderHero();
      renderCategories();
      toast('¡Catálogo actualizado!');
    } catch (e) {
      toast('No se pudo actualizar: ' + e.message);
    }
  }

  /* ================= HERO ================= */
  function renderHero() {
    state.heroList = global.Catalog.featured(state.catalog.movies);
    state.heroIdx = 0;
    paintHero();
    renderHeroDots();
    startHeroRotation();
  }

  function paintHero() {
    const m = state.heroList[state.heroIdx];
    if (!m) return;
    const bg = m.backdrop_url || m.poster_url || '';
    $('hero-bg').style.backgroundImage = bg ? `url('${esc(bg)}')` : '';
    $('hero-eyebrow').textContent = m.tagline ? 'DESTACADA' : 'DESTACADA';
    $('hero-title').textContent = m.title || '';
    $('hero-meta').innerHTML = formatMeta(m);
    $('hero-synopsis').textContent = m.synopsis || '';
    $('hero-play').onclick = () => openPlayer(m);
    $('hero-info').onclick = () => openDetail(m);
  }

  function renderHeroDots() {
    const c = $('hero-dots');
    c.innerHTML = '';
    if (state.heroList.length <= 1) return;
    state.heroList.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'hero-dot' + (i === state.heroIdx ? ' active' : '');
      d.onclick = () => { state.heroIdx = i; paintHero(); updateDots(); restartRotation(); };
      d.setAttribute('aria-label', 'Ir a destacada ' + (i+1));
      c.appendChild(d);
    });
  }
  function updateDots() {
    [...$('hero-dots').children].forEach((d, i) =>
      d.classList.toggle('active', i === state.heroIdx));
  }
  function startHeroRotation() {
    clearInterval(state.heroTimer);
    if (state.heroList.length <= 1) return;
    state.heroTimer = setInterval(() => {
      state.heroIdx = (state.heroIdx + 1) % state.heroList.length;
      paintHero();
      updateDots();
    }, 9000);
  }
  function restartRotation() {
    startHeroRotation();
  }

  /* ================= CATEGORIES ================= */
  function renderCategories() {
    const container = $('categories');
    container.innerHTML = '';
    const movies = state.catalog.movies;

    // "Agregadas recientemente" como primera fila si hay muchas pelis
    if (movies.length >= 4) {
      container.appendChild(renderRow('Agregadas recientemente', global.Catalog.recent(movies, 15)));
    }

    // Categorías en el orden del catalog.categories, luego cualquiera que falte
    const byCat = global.Catalog.groupByCategory(movies);
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
      <div class="row-header">
        <h2 class="row-title">${esc(title)}</h2>
        <span class="row-count">${movies.length} ${movies.length === 1 ? 'película' : 'películas'}</span>
      </div>
      <div class="row-scroller">
        <button class="row-nav left" aria-label="Anterior">‹</button>
        <div class="row-items"></div>
        <button class="row-nav right" aria-label="Siguiente">›</button>
      </div>`;
    const items = row.querySelector('.row-items');
    movies.forEach(m => items.appendChild(renderCard(m)));

    // Botones de scroll en desktop
    const scrollAmount = () => Math.round(items.clientWidth * 0.8);
    row.querySelector('.row-nav.left').onclick = () =>
      items.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
    row.querySelector('.row-nav.right').onclick = () =>
      items.scrollBy({ left: scrollAmount(), behavior: 'smooth' });

    return row;
  }

  function renderCard(m) {
    const card = document.createElement('div');
    card.className = 'card' + (m.poster_url ? '' : ' empty');
    if (m.poster_url) {
      card.style.backgroundImage = `url('${esc(m.poster_url)}')`;
    } else {
      card.textContent = '🎬';
    }

    const adminOn = !!(global.AdminMode && global.AdminMode.isEnabled());
    if (adminOn) {
      // Estrella interactiva (solo visible al admin)
      card.appendChild(buildStarButton(m));
    } else if (m.featured) {
      // Badge no-interactivo para visitantes comunes
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
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(m); }
    });
    return card;
  }

  function formatMeta(m) {
    const p = [];
    if (m.year) p.push(`<span>${esc(m.year)}</span>`);
    if (m.duration_min) p.push(`<span>${m.duration_min} min</span>`);
    if (m.rating) p.push(`<span class="badge">★ ${esc(m.rating)}</span>`);
    if (m.quality) p.push(`<span class="badge">${esc(m.quality)}</span>`);
    if (m.director) p.push(`<span>· ${esc(m.director)}</span>`);
    return p.join('');
  }

  /* ================= DETAIL MODAL ================= */
  function openDetail(m) {
    state.currentMovie = m;
    $('modal-bg').style.backgroundImage = `url('${esc(m.backdrop_url || m.poster_url || '')}')`;
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
    if (m.size_gb) info.push(['Tamaño', m.size_gb + ' GB']);
    if (m.source) info.push(['Fuente', m.source]);
    if (m.added_by) info.push(['Agregada por', m.added_by]);
    $('modal-info').innerHTML = info.map(r =>
      `<div><strong>${esc(r[0])}:</strong> ${esc(r[1])}</div>`
    ).join('');

    $('modal-play').onclick = () => { closeDetail(); openPlayer(m); };

    // Botón admin: destacar / quitar destacada (solo si hay credenciales)
    renderFeaturedButton(m);

    // Botón de traducción de sinopsis
    wireTranslateButton(m);

    state.scrollY = window.scrollY;
    document.body.classList.add('modal-open');
    $('detail-modal').classList.remove('hidden');
    if (global.RemoteNav) global.RemoteNav.setMode('modal');
  }

  function renderFeaturedButton(m) {
    const actions = document.querySelector('#detail-modal .modal-actions');
    if (!actions) return;
    // Quitar cualquier botón admin previo
    const old = actions.querySelector('.admin-feature-btn');
    if (old) old.remove();

    if (!global.AdminMode || !global.AdminMode.isEnabled()) return;

    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary admin-feature-btn';
    btn.dataset.featured = m.featured ? '1' : '0';
    updateFeatBtnLabel(btn, !!m.featured);
    btn.onclick = async () => {
      const newValue = !(btn.dataset.featured === '1');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-icon">…</span> Guardando';
      try {
        await global.AdminMode.toggleFeatured(m.id, newValue);
        // Update in-memory state
        if (newValue) m.featured = true;
        else delete m.featured;
        btn.dataset.featured = newValue ? '1' : '0';
        updateFeatBtnLabel(btn, newValue);
        // Re-render hero + grilla para reflejar el cambio
        renderHero();
        renderCategories();
        toast(newValue ? '⭐ Marcada como destacada' : 'Destacada removida');
      } catch (e) {
        btn.innerHTML = original;
        toast('Error: ' + e.message, 5000);
      } finally {
        btn.disabled = false;
      }
    };
    actions.appendChild(btn);
  }

  function updateFeatBtnLabel(btn, featured) {
    btn.innerHTML = featured
      ? '<span class="btn-icon">★</span> Quitar destacada'
      : '<span class="btn-icon">☆</span> Destacar';
  }

  /**
   * Botón de estrella en cada card (solo para admin).
   * - Destacada: estrella ★ amarilla completa sobre fondo amarillo
   * - No destacada: estrella ☆ vacía con borde amarillo sobre fondo oscuro
   */
  function buildStarButton(m) {
    const star = document.createElement('button');
    star.className = 'card-star';
    star.type = 'button';
    syncStar(star, !!m.featured);
    star.addEventListener('click', async (e) => {
      e.stopPropagation(); // no abrir el detail al tocar la estrella
      e.preventDefault();
      if (star.classList.contains('saving')) return;
      const wasFeatured = !!m.featured;
      const newValue = !wasFeatured;
      star.classList.add('saving');
      syncStar(star, newValue); // optimista
      try {
        await global.AdminMode.toggleFeatured(m.id, newValue);
        if (newValue) m.featured = true;
        else delete m.featured;
        renderHero(); // actualizar hero (cambió la lista de featured)
        toast(newValue ? '⭐ Destacada' : 'Destacada removida', 2000);
      } catch (err) {
        // rollback visual + estado
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
    star.setAttribute('aria-label', star.title);
  }

  /* ================= AUTO-TRADUCCIÓN DE SINOPSIS ================= */
  const TC_KEY = 'cinema_translate_cache_v1';
  const TC_MAX = 500;

  function tcLoad() {
    try { return JSON.parse(localStorage.getItem(TC_KEY) || '{}'); } catch (e) { return {}; }
  }
  function tcSave(cache) {
    try {
      const keys = Object.keys(cache);
      if (keys.length > TC_MAX) {
        keys.sort((a, b) => (cache[a]._t || 0) - (cache[b]._t || 0));
        while (Object.keys(cache).length > TC_MAX) delete cache[keys.shift()];
      }
      localStorage.setItem(TC_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  /**
   * Heurística simple para detectar si un texto está en inglés.
   * - Si tiene caracteres específicos del español (ñ, tildes, ¿¡) → no es inglés
   * - Si tiene suficientes stop-words del inglés → es inglés
   */
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

  async function translateText(text, from, to) {
    const key = from + '|' + to + '|' + text;
    if (translationCache.has(key)) return translationCache.get(key);

    // Cache persistente
    const pc = tcLoad();
    if (pc[key] && pc[key].t) {
      translationCache.set(key, pc[key].t);
      return pc[key].t;
    }

    const params = new URLSearchParams({ q: text, langpair: from + '|' + to });
    const url = 'https://api.mymemory.translated.net/get?' + params.toString();
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const d = await r.json();
    const status = parseInt(d.responseStatus, 10);
    const translated = d.responseData && d.responseData.translatedText;
    if (status !== 200 || !translated) {
      throw new Error(d.responseDetails || 'Sin traducción');
    }
    translationCache.set(key, translated);
    pc[key] = { t: translated, _t: Date.now() };
    tcSave(pc);
    return translated;
  }

  function openGoogleTranslate(text, from, to) {
    const url = `https://translate.google.com/?sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&op=translate&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Auto-traducción de la sinopsis al abrir el modal.
   * - Si la sinopsis ya está en español → no hace nada, oculta el botón
   * - Si está en inglés → lanza fetch de traducción, muestra "Traduciendo…"
   * - Al completarse: reemplaza texto + botón "📖 Ver original" (toggle)
   * - Si falla: botón "🌐 Traducir con Google" (abre Google Translate en nueva pestaña)
   */
  function wireTranslateButton(m) {
    const btn = $('modal-translate');
    const synEl = $('modal-synopsis');
    const original = m.synopsis || '';

    if (btn) {
      btn.style.display = 'none';
      btn.classList.remove('translated', 'loading');
      btn.onclick = null;
    }
    if (!original.trim() || !looksEnglish(original)) return;

    (async () => {
      if (btn) {
        btn.style.display = '';
        btn.classList.add('loading');
        btn.textContent = 'Traduciendo';
      }
      try {
        const translated = await translateText(original, 'en', 'es');
        // Race protection: si el usuario cambió de peli, no tocar el DOM
        if (state.currentMovie !== m) return;
        synEl.textContent = translated;
        if (btn) {
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
        }
      } catch (e) {
        console.error('[translate] MyMemory falló:', e);
        if (state.currentMovie !== m) return;
        if (btn) {
          btn.classList.remove('loading');
          btn.classList.remove('translated');
          btn.textContent = '🌐 Traducir con Google';
          btn.onclick = () => openGoogleTranslate(original, 'en', 'es');
        }
      }
    })();
  }
  function closeDetail() {
    $('detail-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    window.scrollTo(0, state.scrollY);
    if (global.RemoteNav) global.RemoteNav.setMode('home');
  }

  /* ================= PLAYER ================= */
  async function openPlayer(m) {
    if (!m || !m.video_url) { toast('No hay URL para reproducir'); return; }
    state.currentMovie = m;
    $('player-title').textContent = m.title || '';
    document.body.classList.add('player-open');
    $('player-overlay').classList.remove('hidden');
    if (global.RemoteNav) global.RemoteNav.setMode('player');

    const isEmbed = global.WebPlayer.isEmbed(m.video_url);
    try {
      await global.WebPlayer.play(m.video_url);
    } catch (e) {
      toast('Error al reproducir: ' + e.message, 5000);
      closePlayer();
      return;
    }
    // Fullscreen solo para video directo. Los reproductores embebidos tienen
    // su propio botón de fullscreen (y algunos rompen si el iframe entra a fullscreen del documento).
    if (!isEmbed) {
      const c = $('player-overlay');
      if (c.requestFullscreen) {
        try { await c.requestFullscreen(); } catch (e) {}
      }
    }
  }
  function closePlayer() {
    global.WebPlayer.stop();
    $('player-overlay').classList.add('hidden');
    document.body.classList.remove('player-open');
    if (global.RemoteNav) global.RemoteNav.setMode('home');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  /* ================= SEARCH ================= */
  function openSearch() {
    $('search-bar').classList.add('open');
    setTimeout(() => $('search-input').focus(), 50);
  }
  function closeSearch() {
    $('search-bar').classList.remove('open');
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
    const results = global.Catalog.search(state.catalog.movies || [], q);
    $('categories').classList.add('hidden');
    $('hero').style.display = 'none';
    $('search-results').classList.remove('hidden');
    const grid = $('search-grid');
    grid.innerHTML = '';
    results.forEach(m => grid.appendChild(renderCard(m)));
    $('empty-search').classList.toggle('hidden', results.length > 0);
  }

  /* ================= WIRE UP ================= */
  function init() {
    // Header scroll
    window.addEventListener('scroll', () => {
      $('site-header').classList.toggle('scrolled', window.scrollY > 10);
    });

    $('refresh-btn').onclick = refresh;
    $('search-toggle').onclick = openSearch;
    $('search-close').onclick = closeSearch;

    let searchTimer;
    $('search-input').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(handleSearch, 200);
    });
    $('search-input').addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearch();
    });

    // Detail modal
    $('detail-close').onclick = closeDetail;
    $('detail-modal').addEventListener('click', e => {
      if (e.target === $('detail-modal')) closeDetail();
    });

    // Player
    $('player-close').onclick = closePlayer;

    // Video error
    $('player-video').addEventListener('error', () => {
      const v = $('player-video');
      const err = v.error;
      const codes = {1:'ABORTED',2:'NETWORK',3:'DECODE',4:'SRC_NOT_SUPPORTED'};
      toast('Error de reproducción' + (err ? ' (' + (codes[err.code] || err.code) + ')' : ''), 5000);
    });

    // ESC cierra modales/player
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('player-overlay').classList.contains('hidden')) closePlayer();
      else if (!$('detail-modal').classList.contains('hidden')) closeDetail();
      else if ($('search-bar').classList.contains('open')) closeSearch();
    });

    // Fullscreen change: si salen de fullscreen con Esc, cerrar player
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && !$('player-overlay').classList.contains('hidden')) {
        // No cerrar automáticamente — usuario puede querer salir de fullscreen sin cerrar
      }
    });

    // Back button en móviles (historia del navegador)
    window.addEventListener('popstate', () => {
      if (!$('player-overlay').classList.contains('hidden')) closePlayer();
      else if (!$('detail-modal').classList.contains('hidden')) closeDetail();
    });

    // Back del mando (via RemoteNav, keyCodes 461/10009) o Esc desde nav
    window.addEventListener('tv-back', () => {
      if (!$('player-overlay').classList.contains('hidden')) closePlayer();
      else if (!$('detail-modal').classList.contains('hidden')) closeDetail();
      else if ($('search-bar').classList.contains('open')) closeSearch();
    });

    load();
  }

  function scrollTop(e) {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  global.App = { load, refresh, scrollTop };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
