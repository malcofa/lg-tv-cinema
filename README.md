# Cinema Clásico — App para LG webOS TV

App tipo Netflix para TVs LG (webOS), que lee el catálogo de películas desde un **Gist público** y las reproduce directo desde URLs remotas (Internet Archive, pCloud, OneDrive, etc.).

Pensada para contenido de **dominio público** (PDM) y material propio.

---

## 🏗️ Arquitectura

```
Familiares suben pelis a sus nubes (Archive/pCloud/OneDrive)
        │
        ▼
Te pasan la URL directa
        │
        ▼
Helper web (TMDB) → genera bloque JSON
        │
        ▼
Gist (catálogo JSON) ──────────────┐
                                   │
         ┌─── GitHub Actions ──────┼─── Build .ipk
         │                         │
         ▼                         ▼
  TV LG → App carga Gist → muestra grilla → reproduce
```

- **Cero hosting propio** — catálogo en Gist, videos en cuentas de familiares
- **Cero builds locales** — Actions genera el `.ipk` en cada push
- **Actualización dinámica** — agregar peli = editar Gist, no hay que reinstalar la app

---

## 📂 Estructura

```
lg-tv-cinema/
├── appinfo.json            # Manifest webOS
├── index.html              # Entry point
├── icon.png / largeIcon.png / splash.png
├── css/style.css           # Estilos tipo Netflix (1920x1080)
├── js/
│   ├── config.js           # CATALOG_URL del Gist
│   ├── catalog.js          # Fetch + cache en localStorage
│   ├── navigation.js       # Navegación espacial por mando
│   ├── ui.js               # Render hero, grilla, detalle
│   ├── player.js           # Wrapper del <video>
│   └── app.js              # Orquestador
├── catalog-example.json    # Ejemplo de catálogo (pegar al Gist)
├── helper/index.html       # Helper TMDB → JSON (hosteable en GitHub Pages)
└── .github/workflows/build-ipk.yml
```

---

## 🚀 Setup inicial (una sola vez)

### 1. Crear el Gist del catálogo

1. Ir a https://gist.github.com
2. Nombre: `catalog.json`
3. Pegar el contenido de [`catalog-example.json`](catalog-example.json)
4. **Create public gist**
5. Click en **Raw** → copiar la URL (queda tipo `https://gist.githubusercontent.com/USER/HASH/raw/...`)

### 2. Configurar la URL del Gist

Editar [`js/config.js`](js/config.js), reemplazar el valor de `CATALOG_URL`:

```js
CATALOG_URL: 'https://gist.githubusercontent.com/TU_USUARIO/TU_HASH/raw/catalog.json'
```

> ⚠️ Usá la URL **sin** el hash del commit específico. La URL "short" (sin hash) siempre devuelve la última versión.

### 3. Push a GitHub → Actions genera el IPK

```bash
git add . && git commit -m "Config inicial"
git push
```

Esperar a que termine el workflow. Ir a **Actions → último run → Artifacts** y descargar el `.ipk`.

### 4. Habilitar GitHub Pages para el helper (opcional pero recomendado)

En el repo → **Settings → Pages** → Source: `main` branch, folder `/helper` (o `/docs` si preferís mover el folder).

Quedará disponible en `https://TU_USUARIO.github.io/lg-tv-cinema/` y podés usarlo desde cualquier navegador.

### 5. API Key de TMDB para el helper

- Crear cuenta en https://www.themoviedb.org (gratis)
- **Settings → API → Request API Key → Developer**
- Pegarla en el helper (se guarda en localStorage del navegador)

---

## 📺 Instalar la app en la TV

### Opción A — Developer Mode (para desarrollo y uso personal)

1. En la TV: **Content Store → buscar "Developer Mode"** → instalar
2. Abrir la app **Developer Mode** → login con tu cuenta de LG member → activar **Dev Mode Status: ON**
3. La TV muestra su **IP** (ej `192.168.1.42`) y un **passphrase** (6 caracteres)
4. Anotar ambos datos

### Opción B — LG Content Store (publicación oficial)

Proceso aparte, más lento, requiere review de LG. No cubierto en este README.

### Instalar el IPK remotamente (sin cables)

Para **NO instalar `ares-cli` en tu PC**, usá el instalador web oficial:

1. En la TV con Dev Mode: abrir la app **Developer Mode** → ver tu **Device URL** (ej `http://192.168.1.42:9991/`)
2. Abrir esa URL desde un navegador en tu PC
3. Subir el `.ipk` que descargaste de Actions
4. La app aparece en la grilla de apps de la TV

> **Alternativa**: poner el `.ipk` en un pendrive USB → conectar a la TV → usar el botón "Install from USB" en la app Developer Mode.

---

## 🎬 Flujo diario: agregar una película

1. Un familiar sube una peli a su Archive/pCloud/OneDrive y te pasa la URL directa
2. Abrís el helper (GitHub Pages o `helper/index.html` local en navegador)
3. Pegás la API key TMDB (una vez)
4. Buscás la peli → click en el poster → autocomplete de metadata
5. Pegás la URL del video, completás categoría/calidad/fuente
6. Click **Copiar** → el bloque JSON va al portapapeles
7. Abrís tu Gist → **Edit** → pegás dentro del array `movies` → **Update gist**
8. En la TV, tocás **↻ Refrescar** (o cerrar y reabrir) → aparece la nueva peli

---

## 🔄 Actualizar la app (nueva versión del código)

1. Editás código localmente → `git push`
2. Actions genera nuevo `.ipk` automáticamente
3. Lo instalás encima del anterior (la TV sobreescribe)

> **El catálogo NO requiere rebuild** — solo editar el Gist.

---

## 🎯 Hosting recomendado por familiar

| Servicio | Free | Streaming directo | Link directo |
|---|---|---|---|
| **Internet Archive** | ∞ | ⭐⭐⭐⭐⭐ | `archive.org/download/ID/file.mp4` |
| **pCloud** | 10 GB | ⭐⭐⭐⭐ | Link público → da URL `.mp4` |
| **OneDrive** | 5 GB | ⭐⭐⭐ | Link con `?download=1` |
| **Dropbox** | 2 GB | ⭐⭐ | `?dl=1`, ancho de banda limitado |
| **Google Drive** | 15 GB | ⭐ | Mejor evitar — quota diaria y warnings |

**Recomendación**: empujar a la familia a usar Internet Archive. Es gratis, ilimitado, diseñado para PDM, y la URL nunca se cae.

---

## 🎛️ Controles del mando en la app

| Botón | Acción |
|---|---|
| Flechas | Navegar entre cards / botones |
| OK / Enter | Seleccionar |
| Back / Volver | Retroceder pantalla |
| Play / Pause | Play/Pausa en el player |
| ← / → (en player) | Retroceder / adelantar 10 seg |

---

## 🧪 Testing

**Sin emulador local** (por regla del proyecto):

1. **Helper**: se prueba en cualquier navegador — abrir `helper/index.html` directamente
2. **UI de la app**: `index.html` se puede abrir en Chrome también, pero el foco del mando no funciona (usar flechas del teclado sí anda)
3. **Reproducción real**: solo en TV (el emulador LG requiere VirtualBox, fuera de scope)

Si algún video no reproduce en la TV, es casi siempre por:
- Codec no soportado (usá MP4 H.264/AAC)
- URL con redirects (Google Drive, Mega sin API)
- HTTPS con certificado inválido
- Archivo muy grande con seek no optimizado

---

## 🔧 Troubleshooting

**"No se pudo cargar el catálogo"**
- URL del Gist mal en `js/config.js`
- Gist es privado (tiene que ser público)
- Problema de conexión en la TV

**"Error de reproducción"**
- La URL del video no es directa o redirige
- Codec no soportado por webOS
- Probar la URL en un navegador común primero — si no reproduce ahí, tampoco en la TV

**La peli que agregué no aparece**
- Tocá **↻ Refrescar** en el top bar (bypasea el cache de 5 min)
- Verificá que el JSON del Gist es válido (usar https://jsonlint.com)
- Mirá la consola del `ares-inspect` en la TV (si es dev)

---

## 📦 Requisitos

- **TV**: LG webOS 3.0+ (modelos 2016+)
- **Cuenta LG member** (free) para habilitar Dev Mode
- **Cuenta GitHub** (free) para repo + Actions + Gist + Pages
- **Cuenta TMDB** (free) para el helper

---

## 📜 Licencia

Código MIT. Contenido servido por la app: responsabilidad de quien lo sube.
