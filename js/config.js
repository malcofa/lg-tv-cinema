/**
 * Configuración global de la app.
 * CATALOG_URL = URL raw del Gist JSON con el catálogo de películas.
 *
 * Para cambiarlo sin rebuildear: editás el Gist, los usuarios ven los
 * cambios en el próximo fetch (al reabrir la app o tocar "Refrescar").
 */
window.APP_CONFIG = {
  // URL raw del Gist. Reemplazar con la real después de crearlo.
  CATALOG_URL: 'https://gist.githubusercontent.com/malcofa/b74171318151c72fd3be5941e28716d2/raw/catalog.json',

  // Cache local del catálogo (minutos). Evita pegarle a Gist en cada apertura.
  CACHE_TTL_MINUTES: 5,

  // Timeout del fetch (ms).
  FETCH_TIMEOUT_MS: 10000,

  // Cantidad de ítems del hero rotatorio (los primeros featured del catálogo).
  HERO_ROTATION_MS: 8000,

  // Debug: muestra logs en consola.
  DEBUG: true
};
