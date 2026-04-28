/**
 * Renderizado de pantallas: Home (hero + grilla), Detalle.
 * Compatible Chromium 38+ (ES5).
 */
(function(global) {
  'use strict';

  var catalogData = null;
  var heroRotationTimer = null;
  var heroIndex = 0;

  var ESC_MAP = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) { return ESC_MAP[c]; });
  }
  // Escape de URLs para usar dentro de url("...") en CSS.
  // Solo escapa " y \, porque las HTML entities rompen URLs.
  function cssUrl(s) {
    if (s == null) return '';
    return String(s).replace(/[\\"]/g, '\\$&');
  }

  function formatMeta(m) {
    var parts = [];
    if (m.year) parts.push('<span>' + esc(m.year) + '</span>');
    if (m.duration_min) parts.push('<span>' + m.duration_min + ' min</span>');
    if (m.rating) parts.push('<span class="badge">★ ' + esc(m.rating) + '</span>');
    if (m.quality) parts.push('<span class="badge">' + esc(m.quality) + '</span>');
    if (m.country) parts.push('<span>' + esc(m.country) + '</span>');
    return parts.join('');
  }

  function renderHero(movie) {
    var hero = document.getElementById('hero');
    if (!movie) return;
    var bg = hero.querySelector('.hero-bg');
    bg.style.backgroundImage = 'url("' + cssUrl(movie.backdrop_url || movie.poster_url || '') + '")';
    hero.querySelector('.hero-tagline').textContent = movie.tagline || 'Destacada';
    hero.querySelector('.hero-title').textContent = movie.title || '';
    hero.querySelector('.hero-meta').innerHTML = formatMeta(movie);
    hero.querySelector('.hero-synopsis').textContent = movie.synopsis || '';
    hero.setAttribute('data-movie-id', movie.id);
  }

  function startHeroRotation(featuredList) {
    if (heroRotationTimer) clearInterval(heroRotationTimer);
    if (!featuredList || featuredList.length <= 1) return;
    heroRotationTimer = setInterval(function() {
      heroIndex = (heroIndex + 1) % featuredList.length;
      renderHero(featuredList[heroIndex]);
    }, (global.APP_CONFIG && global.APP_CONFIG.HERO_ROTATION_MS) || 8000);
  }

  function stopHeroRotation() {
    if (heroRotationTimer) { clearInterval(heroRotationTimer); heroRotationTimer = null; }
  }

  function renderCategories(byCategory, order) {
    var container = document.getElementById('categories');
    container.innerHTML = '';
    container.style.transform = 'translateY(0)';

    for (var oi = 0; oi < order.length; oi++) {
      var catName = order[oi];
      var movies = byCategory[catName];
      if (!movies || movies.length === 0) continue;
      var row = document.createElement('section');
      row.className = 'row';
      row.innerHTML =
        '<h3 class="row-title">' + esc(catName) + '</h3>' +
        '<div class="row-items"></div>';
      var items = row.querySelector('.row-items');
      for (var mi = 0; mi < movies.length; mi++) {
        var m = movies[mi];
        var card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-movie-id', m.id);
        card.setAttribute('tabindex', '0'); // necesario para .focus() nativo
        if (m.poster_url) {
          card.style.backgroundImage = 'url("' + cssUrl(m.poster_url) + '")';
        } else {
          card.innerHTML = '<div class="card-placeholder">🎬</div>';
        }
        var overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        overlay.innerHTML =
          '<div class="card-title">' + esc(m.title) + '</div>' +
          '<div class="card-info">' + esc(m.year || '') + ' · ' + esc(m.duration_min ? m.duration_min + ' min' : '') + '</div>';
        card.appendChild(overlay);
        items.appendChild(card);
      }
      container.appendChild(row);
    }
  }

  function buildHomeFocusables() {
    var items = [];
    var refreshBtn = document.querySelector('[data-nav="refresh"]');
    if (refreshBtn) items.push({ el: refreshBtn, group: 'top', col: 0, row: 0 });

    var heroPlay = document.querySelector('[data-nav="hero-play"]');
    var heroInfo = document.querySelector('[data-nav="hero-info"]');
    if (heroPlay) items.push({ el: heroPlay, group: 'hero', col: 0, row: 1 });
    if (heroInfo) items.push({ el: heroInfo, group: 'hero', col: 1, row: 1 });

    var rows = document.querySelectorAll('#categories .row');
    for (var ri = 0; ri < rows.length; ri++) {
      var cards = rows[ri].querySelectorAll('.card');
      for (var ci = 0; ci < cards.length; ci++) {
        items.push({
          el: cards[ci],
          group: 'cat-' + ri,
          col: ci,
          row: 2 + ri
        });
      }
    }
    return items;
  }

  function renderHome(catalog) {
    catalogData = catalog;
    var movies = catalog.movies || [];

    var byCategory = global.Catalog.groupByCategory(movies);
    var keys = [];
    for (var k in byCategory) { if (byCategory.hasOwnProperty(k)) keys.push(k); }

    var order;
    if (catalog.categories && catalog.categories.length) {
      order = [];
      for (var oi = 0; oi < catalog.categories.length; oi++) {
        var c = catalog.categories[oi];
        if (byCategory[c]) order.push(c);
      }
    } else {
      order = keys.slice().sort();
    }
    // Agrega categorías que existan pero no estén listadas
    for (var ki = 0; ki < keys.length; ki++) {
      if (order.indexOf(keys[ki]) < 0) order.push(keys[ki]);
    }

    var feat = global.Catalog.featured(movies);
    heroIndex = 0;
    renderHero(feat[0]);
    startHeroRotation(feat);

    renderCategories(byCategory, order);

    var updEl = document.getElementById('updated-at');
    if (updEl && catalog.updated_at) {
      try {
        var d = new Date(catalog.updated_at);
        updEl.textContent = 'Actualizado ' + d.toLocaleDateString('es');
      } catch (e) { updEl.textContent = ''; }
    }
  }

  function findMovieById(id) {
    if (!catalogData || !catalogData.movies) return null;
    for (var i = 0; i < catalogData.movies.length; i++) {
      if (catalogData.movies[i].id === id) return catalogData.movies[i];
    }
    return null;
  }

  function renderDetail(movie) {
    if (!movie) return;
    var d = document.getElementById('detail');
    d.querySelector('.detail-bg').style.backgroundImage =
      'url("' + cssUrl(movie.backdrop_url || movie.poster_url || '') + '")';
    d.querySelector('.detail-title').textContent = movie.title || '';
    d.querySelector('.detail-meta').innerHTML = formatMeta(movie);
    d.querySelector('.detail-tagline').textContent = movie.tagline || '';
    d.querySelector('.detail-synopsis').textContent = movie.synopsis || '';

    var info = d.querySelector('.detail-info');
    var rows = [];
    if (movie.director) rows.push(['Director', movie.director]);
    if (movie.original_title) rows.push(['Título original', movie.original_title]);
    if (movie.country) rows.push(['País', movie.country]);
    if (movie.language) rows.push(['Idioma', movie.language]);
    if (movie.subtitles && movie.subtitles.length) rows.push(['Subtítulos', movie.subtitles.join(', ')]);
    if (movie.genres && movie.genres.length) rows.push(['Géneros', movie.genres.join(', ')]);
    if (movie.size_gb) rows.push(['Tamaño', movie.size_gb + ' GB']);
    if (movie.source) rows.push(['Fuente', movie.source]);
    if (movie.added_by) rows.push(['Agregada por', movie.added_by]);
    var html = '';
    for (var ri = 0; ri < rows.length; ri++) {
      html += '<div><strong>' + esc(rows[ri][0]) + ':</strong> ' + esc(rows[ri][1]) + '</div>';
    }
    info.innerHTML = html;

    d.setAttribute('data-movie-id', movie.id);
  }

  function buildDetailFocusables() {
    var items = [];
    var back = document.querySelector('#detail [data-nav="detail-back"]');
    var play = document.querySelector('#detail [data-nav="detail-play"]');
    if (back) items.push({ el: back, group: 'detail', col: 0, row: 0 });
    if (play) items.push({ el: play, group: 'detail', col: 0, row: 1 });
    return items;
  }

  function showToast(msg, ms) {
    var t = document.getElementById('error-toast');
    document.getElementById('error-msg').textContent = msg;
    t.classList.add('visible');
    setTimeout(function() { t.classList.remove('visible'); }, ms || 4000);
  }

  function getHeroMovie() {
    if (!catalogData) return null;
    var hero = document.getElementById('hero');
    if (!hero) return null;
    return findMovieById(hero.getAttribute('data-movie-id'));
  }

  global.UI = {
    renderHome: renderHome,
    renderDetail: renderDetail,
    buildHomeFocusables: buildHomeFocusables,
    buildDetailFocusables: buildDetailFocusables,
    findMovieById: findMovieById,
    getHeroMovie: getHeroMovie,
    stopHeroRotation: stopHeroRotation,
    showToast: showToast
  };
})(window);
