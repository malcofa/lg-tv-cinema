/**
 * Renderizado de pantallas: Home (hero + grilla), Detalle.
 */
(function(global) {
  'use strict';

  let catalogData = null;
  let heroRotationTimer = null;
  let heroIndex = 0;

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatMeta(m) {
    const parts = [];
    if (m.year) parts.push(`<span>${esc(m.year)}</span>`);
    if (m.duration_min) parts.push(`<span>${m.duration_min} min</span>`);
    if (m.rating) parts.push(`<span class="badge">★ ${esc(m.rating)}</span>`);
    if (m.quality) parts.push(`<span class="badge">${esc(m.quality)}</span>`);
    if (m.country) parts.push(`<span>${esc(m.country)}</span>`);
    return parts.join('');
  }

  function renderHero(movie) {
    const hero = document.getElementById('hero');
    if (!movie) return;
    const bg = hero.querySelector('.hero-bg');
    bg.style.backgroundImage = `url('${esc(movie.backdrop_url || movie.poster_url || '')}')`;
    hero.querySelector('.hero-tagline').textContent = movie.tagline || 'Destacada';
    hero.querySelector('.hero-title').textContent = movie.title || '';
    hero.querySelector('.hero-meta').innerHTML = formatMeta(movie);
    hero.querySelector('.hero-synopsis').textContent = movie.synopsis || '';
    hero.dataset.movieId = movie.id;
  }

  function startHeroRotation(featuredList) {
    if (heroRotationTimer) clearInterval(heroRotationTimer);
    if (!featuredList || featuredList.length <= 1) return;
    heroRotationTimer = setInterval(() => {
      heroIndex = (heroIndex + 1) % featuredList.length;
      renderHero(featuredList[heroIndex]);
    }, global.APP_CONFIG.HERO_ROTATION_MS || 8000);
  }

  function stopHeroRotation() {
    if (heroRotationTimer) { clearInterval(heroRotationTimer); heroRotationTimer = null; }
  }

  function renderCategories(byCategory, order) {
    const container = document.getElementById('categories');
    container.innerHTML = '';
    container.style.transform = 'translateY(0)';

    order.forEach(catName => {
      const movies = byCategory[catName];
      if (!movies || movies.length === 0) return;
      const row = document.createElement('section');
      row.className = 'row';
      row.innerHTML = `
        <h3 class="row-title">${esc(catName)}</h3>
        <div class="row-items"></div>
      `;
      const items = row.querySelector('.row-items');
      movies.forEach(m => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.movieId = m.id;
        if (m.poster_url) {
          card.style.backgroundImage = `url('${esc(m.poster_url)}')`;
        } else {
          card.innerHTML = `<div class="card-placeholder">🎬</div>`;
        }
        const overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        overlay.innerHTML = `
          <div class="card-title">${esc(m.title)}</div>
          <div class="card-info">${esc(m.year || '')} · ${esc(m.duration_min ? m.duration_min + ' min' : '')}</div>
        `;
        card.appendChild(overlay);
        items.appendChild(card);
      });
      container.appendChild(row);
    });
  }

  function buildHomeFocusables() {
    const items = [];
    // Fila 0: top bar (refresh)
    const refreshBtn = document.querySelector('[data-nav="refresh"]');
    if (refreshBtn) items.push({ el: refreshBtn, group: 'top', col: 0, row: 0 });

    // Fila 1: hero acciones
    const heroPlay = document.querySelector('[data-nav="hero-play"]');
    const heroInfo = document.querySelector('[data-nav="hero-info"]');
    if (heroPlay) items.push({ el: heroPlay, group: 'hero', col: 0, row: 1 });
    if (heroInfo) items.push({ el: heroInfo, group: 'hero', col: 1, row: 1 });

    // Fila 2..N: cards por categoría
    const rows = document.querySelectorAll('#categories .row');
    rows.forEach((row, rowIdx) => {
      const cards = row.querySelectorAll('.card');
      cards.forEach((card, colIdx) => {
        items.push({
          el: card,
          group: `cat-${rowIdx}`,
          col: colIdx,
          row: 2 + rowIdx
        });
      });
    });

    return items;
  }

  function renderHome(catalog) {
    catalogData = catalog;
    const movies = catalog.movies || [];

    // Categorías: orden explícito en catalog.categories (si existe) o alfabético.
    const byCategory = global.Catalog.groupByCategory(movies);
    const order = (catalog.categories && catalog.categories.length)
      ? catalog.categories.filter(c => byCategory[c])
      : Object.keys(byCategory).sort();

    // Agrega categorías que existan pero no estén listadas
    Object.keys(byCategory).forEach(c => {
      if (order.indexOf(c) < 0) order.push(c);
    });

    const feat = global.Catalog.featured(movies);
    heroIndex = 0;
    renderHero(feat[0]);
    startHeroRotation(feat);

    renderCategories(byCategory, order);

    // updated_at
    const updEl = document.getElementById('updated-at');
    if (updEl && catalog.updated_at) {
      try {
        const d = new Date(catalog.updated_at);
        updEl.textContent = 'Actualizado ' + d.toLocaleDateString('es');
      } catch (e) { updEl.textContent = ''; }
    }
  }

  function findMovieById(id) {
    if (!catalogData || !catalogData.movies) return null;
    return catalogData.movies.find(m => m.id === id);
  }

  function renderDetail(movie) {
    if (!movie) return;
    const d = document.getElementById('detail');
    d.querySelector('.detail-bg').style.backgroundImage =
      `url('${esc(movie.backdrop_url || movie.poster_url || '')}')`;
    d.querySelector('.detail-title').textContent = movie.title || '';
    d.querySelector('.detail-meta').innerHTML = formatMeta(movie);
    d.querySelector('.detail-tagline').textContent = movie.tagline || '';
    d.querySelector('.detail-synopsis').textContent = movie.synopsis || '';

    const info = d.querySelector('.detail-info');
    const rows = [];
    if (movie.director) rows.push(['Director', movie.director]);
    if (movie.original_title) rows.push(['Título original', movie.original_title]);
    if (movie.country) rows.push(['País', movie.country]);
    if (movie.language) rows.push(['Idioma', movie.language]);
    if (movie.subtitles && movie.subtitles.length) rows.push(['Subtítulos', movie.subtitles.join(', ')]);
    if (movie.genres && movie.genres.length) rows.push(['Géneros', movie.genres.join(', ')]);
    if (movie.size_gb) rows.push(['Tamaño', movie.size_gb + ' GB']);
    if (movie.source) rows.push(['Fuente', movie.source]);
    if (movie.added_by) rows.push(['Agregada por', movie.added_by]);
    info.innerHTML = rows.map(r =>
      `<div><strong>${esc(r[0])}:</strong> ${esc(r[1])}</div>`
    ).join('');

    d.dataset.movieId = movie.id;
  }

  function buildDetailFocusables() {
    const items = [];
    const back = document.querySelector('#detail [data-nav="detail-back"]');
    const play = document.querySelector('#detail [data-nav="detail-play"]');
    if (back) items.push({ el: back, group: 'detail', col: 0, row: 0 });
    if (play) items.push({ el: play, group: 'detail', col: 0, row: 1 });
    return items;
  }

  function showToast(msg, ms) {
    const t = document.getElementById('error-toast');
    document.getElementById('error-msg').textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), ms || 4000);
  }

  global.UI = {
    renderHome: renderHome,
    renderDetail: renderDetail,
    buildHomeFocusables: buildHomeFocusables,
    buildDetailFocusables: buildDetailFocusables,
    findMovieById: findMovieById,
    getHeroMovie: () => catalogData && findMovieById(document.getElementById('hero').dataset.movieId),
    stopHeroRotation: stopHeroRotation,
    showToast: showToast
  };
})(window);
