# Cinema Premium 🎬

Plataforma tipo Netflix para películas de **dominio público** (Public Domain Movies). Tres frentes sobre el mismo catálogo:

| 🌐 URL | Para qué |
|---|---|
| https://malcofa.github.io/lg-tv-cinema/ | **Player web público** — responsive, mobile + desktop |
| https://malcofa.github.io/lg-tv-cinema/app/ | Preview del app de TV (se instala en LG webOS via `.ipk`) |
| https://malcofa.github.io/lg-tv-cinema/admin/ | Admin CRUD — edita el catálogo directo al Gist |

---

## 🏗️ Arquitectura

```
Familiares suben pelis a sus nubes (Archive/pCloud/OneDrive)
        │
        ▼
Te pasan la URL directa
        │
        ▼
Admin CRUD (/admin/) ──► Gist público (catálogo JSON)
                              │
                              ▼
          ┌──────────────────┴──────────────────┐
          │                                     │
          ▼                                     ▼
   Web Player (/)                       TV App (/app/ → .ipk)
   (browsers: desktop/mobile)           (LG webOS en TV)
```

- **Cero hosting propio de video** — cada familiar sube a su nube
- **Cero builds locales** — GitHub Actions genera el `.ipk` en cada push
- **Un solo catálogo** en un Gist → los dos players consumen lo mismo
- **Actualización dinámica** — agregar peli = editar Gist, no hay que reinstalar nada

---

## 📂 Estructura del repo

```
lg-tv-cinema/
├── index.html              ← Player web (/)
├── css/style.css
├── js/
│   ├── app.js              ← UI, hero, grilla, modal, búsqueda
│   ├── catalog.js          ← fetch + cache del Gist
│   └── player.js           ← <video> + HLS.js condicional
├── app/                     ← App de TV (webOS)
│   ├── appinfo.json
│   ├── index.html
│   ├── icon.png / largeIcon.png / splash.png
│   ├── css/style.css
│   └── js/*.js             ← con navegación espacial por mando
├── admin/
│   └── index.html          ← CRUD con autenticación por PAT
├── .github/workflows/
│   └── build-ipk.yml       ← empaqueta /app/ → .ipk
├── catalog-example.json
└── README.md
```

---

## 🌐 Player web (`/`)

- Responsive (mobile-first → 4K)
- Hero rotatorio con pelis destacadas (`featured: true`)
- Filas horizontales con scroll por categoría
- "Agregadas recientemente" auto-generada
- Modal de detalle con sinopsis, director, país, etc.
- Búsqueda por título, director, año, género, sinopsis
- Player nativo HTML5 + HLS.js (CDN) para `.m3u8`
- Fullscreen automático al dar play (desktop)
- Cache de catálogo 5min + fallback si el Gist está caído

### Hosting del catálogo
Ver `js/catalog.js` — apunta al Gist público. Cualquier familiar/amigo puede clonar este repo y apuntar a SU propio Gist para tener su propia instancia.

---

## 📺 App de TV (`/app/` + `.ipk`)

Fuente del paquete webOS (se instala como app nativa en TV LG via Developer Mode). Para uso en browser de TV, ver el roadmap de `/tv/`.

App webOS vanilla HTML/CSS/JS, optimizada para 1920x1080 + mando a distancia.

### Instalar en TV LG

1. TV → **Content Store → Developer Mode** → instalar, activar con cuenta LG member
2. Anotá la **IP** de la TV + passphrase
3. Descargá el `.ipk` desde **[Actions → último run](https://github.com/malcofa/lg-tv-cinema/actions) → Artifacts**
4. Abrí `http://<IP-TV>:9991/` desde el navegador de tu PC
5. Subí el `.ipk` → aparece en la grilla de apps

**Alternativa USB**: poner el `.ipk` en un pendrive → conectar a la TV → "Install from USB" en Developer Mode.

### Controles del mando

| Botón | Acción |
|---|---|
| Flechas | Navegar |
| OK | Seleccionar |
| Back | Retroceder pantalla |
| Play/Pause | Play/Pausa |
| ←/→ (en player) | Retroceder/adelantar 10s |

---

## 🎛️ Admin CRUD (`/admin/`)

Mini-app web para editar el catálogo sin tocar JSON a mano.

### Setup inicial (una vez)

1. Abrí https://malcofa.github.io/lg-tv-cinema/admin/
2. **GitHub PAT**: crear en https://github.com/settings/tokens/new?scopes=gist → **Classic** (NO fine-grained, dan 403 en Gist API) → scope: `gist`
3. **Gist ID**: ya viene pre-cargado (`b74171318151c72fd3be5941e28716d2`)
4. **TMDB Key** (opcional): https://www.themoviedb.org/settings/api

Todo queda en localStorage — nunca sale del navegador.

### Flujo diario

1. Un familiar te manda un link por WhatsApp
2. Abrís el admin → **+ Nueva película**
3. (Opcional) Buscás el título en TMDB → click al poster → metadata auto-completada
4. Pegás la URL del video, completás categoría/calidad/fuente
5. **💾 Guardar** → sincroniza al Gist
6. Los players (web + TV) muestran la nueva peli cuando refresquen

---

## 🎯 Hosting recomendado para videos

| Servicio | Free | Streaming | Notas |
|---|---|---|---|
| **Internet Archive** | ∞ | ⭐⭐⭐⭐⭐ | El mejor. Diseñado para PDM, URLs estables, sin quota |
| **pCloud** | 10 GB | ⭐⭐⭐⭐ | Link público funciona como URL directa |
| **OneDrive** | 5 GB | ⭐⭐⭐ | Con `?download=1` funciona |
| **Dropbox** | 2 GB | ⭐⭐ | `?dl=1`, bandwidth limitado |
| **Google Drive** | 15 GB | ⭐ | Evitar — quota diaria y warnings |

**Recomendación**: empujá a la familia a Internet Archive. Gratis, ilimitado, aporte cultural real.

---

## 🧪 Testing local

- **Player web**: abrir `index.html` en cualquier navegador
- **Admin**: `admin/index.html` — funciona desde `file://` sin problema
- **TV app**: solo en TV real (el emulador LG requiere VirtualBox, fuera de scope)

---

## 🔧 Troubleshooting

**"No se pudo cargar el catálogo"**
- Gist privado o URL incorrecta
- Cache del navegador: Ctrl+Shift+R

**"Error de reproducción"**
- Codec no soportado (usá MP4 H.264/AAC, nunca MKV/HEVC)
- URL con redirects (Google Drive, Mega sin API oficial)
- Probá la URL en un navegador — si no anda ahí, tampoco en la app

**La peli agregada no aparece en el player**
- Tocá **↻ Refrescar** en el header
- Esperá ~5 min (cache del cliente) o limpiá localStorage

---

## 📦 Requisitos

- **TV**: LG webOS 3.0+ (modelos 2016+)
- **Cuenta LG member** (free) para Dev Mode
- **Cuenta GitHub** (free) para repo + Actions + Gist + Pages
- **Cuenta TMDB** (free, opcional) para autocompletar metadata

---

## 📜 Licencia y contenido

- Código: MIT
- Contenido: cada película debe ser de dominio público. Ejemplos legítimos: Battleship Potemkin (1925), Broken Blossoms (1919), Convict 13 (1920), Nosferatu (1922), Nomads of the North (1920), Flesh and Blood (1922), Girl Shy (1924).
