# Arena · Gestor de Torneos de Esports

Aplicación web de una sola página (SPA) para organizar torneos de esports: crear torneos, registrar equipos, inscribirlos, registrar partidas con estadísticas y generar **crónicas post-partida con IA** (Gemini API) con un **modo de respaldo local** que garantiza que la demostración nunca falle.

Proyecto construido con **HTML5, CSS3 y JavaScript Vanilla**, sin frameworks ni dependencias externas (ni siquiera fuentes o íconos remotos).

---

## 1. Cómo ejecutarlo

No requiere instalación ni servidor.

1. Clona o descarga el repositorio.
2. Abre `frontend/index.html` en el navegador (doble clic) **o** usa la extensión *Live Server* de VS Code (clic derecho sobre `index.html` → *Open with Live Server*).
3. Al primer arranque se precargan **2 torneos, 4 equipos y 2 partidas jugadas**. Puedes volver a ese estado en cualquier momento con el botón **Restaurar datos de prueba** de la barra superior.

> Los scripts se cargan con etiquetas `<script>` clásicas (patrón de espacio de nombres globales) en lugar de ES Modules, porque los módulos no funcionan al abrir un archivo con `file://`.

## 2. Estructura del proyecto

```text
gestor-torneos-esports/
├── README.md                # Este documento
├── frontend/
│   ├── index.html           # SPA: vistas, formularios y sprite de íconos SVG
│   ├── css/
│   │   └── styles.css       # Diseño Esports: modo oscuro, neón, responsive
│   └── js/
│       ├── data.js          # Persistencia (localStorage) y datos iniciales
│       ├── validations.js   # Validaciones y reglas de negocio
│       ├── aiService.js     # Gemini API + generador local de respaldo
│       └── app.js           # Controlador: rutas, render y eventos
└── docs/
    └── EVIDENCIAS.md        # Guía de capturas y pruebas
```

### Responsabilidad de cada archivo

| Archivo | Rol | API pública |
|---|---|---|
| `data.js` | Modelo de datos y persistencia. No conoce el DOM. | `window.EsportsData` |
| `validations.js` | Reglas de negocio y utilidades de validación en vivo. No conoce los datos: recibe un contexto. | `window.Validators` |
| `aiService.js` | Construye el prompt, llama a Gemini y, si algo falla, usa el generador local. | `window.AIService` |
| `app.js` | Une todo: navegación por hash, renderizado y eventos. | — |

Orden de carga en `index.html`: `data.js` → `validations.js` → `aiService.js` → `app.js`.

## 3. Funcionalidades

### Navegación (SPA)
Cinco vistas sin recargar la página, con rutas por hash (`#/dashboard`, `#/torneos`, `#/equipos`, `#/partidas`, `#/cronicas`): **Dashboard**, **Torneos**, **Equipos**, **Partidas y Resultados** y **Crónicas IA**. En móvil la navegación pasa a una barra inferior.

### Torneos
- Formulario: nombre, videojuego, formato, fecha y premio.
- Listado con estado **Abierto / En curso / Finalizado**, equipos inscritos y número de partidas.
- El estado se cambia desde la propia tarjeta.

### Equipos
- Registro: nombre, tag (2–5 caracteres), juego principal, capitán y jugadores.
- Inscripción a torneos desde un formulario dedicado (solo muestra equipos del mismo juego que el torneo).

### Partidas y resultados
- Equipo A vs. Equipo B, marcador, duración, jugador MVP, K/D/A y objetivos.
- Tarjetas con marcador estilo transmisión; el ganador se resalta.
- Al registrar la primera partida de un torneo **Abierto**, este pasa automáticamente a **En curso**.

### Dashboard
Última partida como protagonista, cifras generales, torneos activos y tabla de posiciones calculada a partir de los resultados (PJ, G, P, diferencia).

### Crónicas con IA
1. Elige una partida registrada **o** ingresa *datos rápidos*.
2. (Opcional) pega tu API Key de Gemini.
3. Pulsa **Generar crónica con IA**.
4. Obtienes dos bloques con botón **Copiar texto**:
   - **Post para redes sociales** (X / Instagram): tono épico, emojis, MVP y hashtags del torneo.
   - **Crónica oficial para la web del evento**: párrafo periodístico adaptado a duración, marcador y estadísticas.

## 4. Validaciones y reglas de negocio

Las validaciones corren **en tiempo real** (al interactuar con cada campo) y **al enviar** (se revisan todos y se enfoca el primer error). Los campos inválidos se marcan en rojo con mensaje; los válidos, en verde.

| Área | Regla |
|---|---|
| Torneos | Campos obligatorios; nombre de 3 a 60 caracteres; **no se repiten nombres** de torneo; fecha válida. |
| Equipos | Campos obligatorios; **nombre y tag únicos**; tag alfanumérico de 2 a 5 caracteres; máximo 8 jugadores sin nombres repetidos ni el capitán duplicado. |
| Inscripción | **Un equipo no puede inscribirse dos veces en el mismo torneo**; el torneo no puede estar Finalizado; el juego del equipo debe coincidir con el del torneo. |
| Partidas | Torneo y equipos obligatorios; equipos distintos e **inscritos en ese torneo**; torneo no Finalizado; **marcadores, duración y estadísticas enteros y no negativos**; duración ≥ 1; sin empates (debe haber ganador); MVP obligatorio. |
| Integridad | No se puede eliminar un equipo con partidas; no se puede retirar de un torneo a un equipo que ya jugó en él; no se puede reabrir un torneo con partidas; al eliminar un torneo se eliminan sus partidas (con confirmación). |
| Datos rápidos (IA) | Mismas reglas numéricas que las partidas; equipos distintos y juego obligatorio. |

## 5. Persistencia

Todo se guarda en `localStorage` bajo la clave `arena.gestorTorneos.v1`. Si el navegador lo bloquea, la app sigue funcionando en memoria y avisa al usuario. El botón **Restaurar datos de prueba** reemplaza el contenido por los datos iniciales (con confirmación).

## 6. Servicio de IA

### Flujo de decisión

```text
Generar crónica
     │
     ├─ ¿Hay API Key?  ── no ──► Generador local
     ├─ ¿Hay conexión? ── no ──► Generador local
     └─ Llamada a Gemini
           ├─ OK ──► Resultado de Gemini
           └─ Error (clave inválida, límite, timeout, red, JSON inválido) ──► Generador local
```

Nunca se muestra un error vacío al usuario: la interfaz indica siempre el origen del texto (*Generado con Gemini* o *Modo respaldo local* con el motivo).

### Gemini API
- Endpoint `generateContent` del modelo configurado en `AIService.config.model` (por defecto `gemini-2.5-flash`; puedes cambiarlo en la parte superior de `aiService.js`).
- Se envían los datos reales de la partida (torneo, juego, equipos, marcador, duración, MVP, K/D/A y objetivos) y se exige una respuesta JSON con las claves `social` y `chronicle`.
- Tiempo máximo de espera: 20 segundos.
- Para obtener una clave: [Google AI Studio](https://aistudio.google.com/apikey).

### Generador local (modo respaldo)
Es determinista (la misma partida produce el mismo texto) y se adapta a los datos:
- **Duración**: relámpago (≤ 25 min), equilibrada (≤ 45), larga (≤ 70) o maratón.
- **Margen del marcador**: dominante, ajustado o normal.
- **MVP**: KDA, acciones de combate y ritmo por minuto.
- **Objetivos**: descritos según el videojuego (spike, dragones/barones, bomba, etc.).
- **Hashtags** generados a partir del torneo, el juego y el tag del ganador.

### Seguridad de la API Key
La clave se escribe en un campo de contraseña y solo se conserva en `sessionStorage` (se borra al cerrar la pestaña). **Nunca se guarda en el código ni en `localStorage`.** Al ser una app 100 % cliente, la clave viaja desde el navegador del usuario; para un despliegue real se recomienda un backend intermediario.

## 7. Diseño

- Modo oscuro de alto contraste con acentos neón (cian, magenta y ámbar para el MVP).
- Elemento protagonista: el **marcador** estilo transmisión, que resalta al ganador.
- Íconos SVG integrados (sprite `<symbol>` en `index.html`); sin fuentes ni imágenes remotas.
- Responsive (escritorio, tableta y móvil), foco visible, enlace «Saltar al contenido», etiquetas y `aria-live` para errores y avisos, y respeto de `prefers-reduced-motion`.

## 8. Secuencia de commits sugerida

```bash
git init
git branch -M main

# 1. Estructura base e interfaz
git add README.md frontend/index.html frontend/css/styles.css
git commit -m "feat(ui): estructura base, navegación SPA y estilo esports"

# 2. Persistencia y datos de prueba
git add frontend/js/data.js
git commit -m "feat(data): persistencia en localStorage y datos iniciales precargados"

# 3. Torneos y equipos
git add frontend/js/app.js
git commit -m "feat(app): gestión de torneos, equipos e inscripciones"

# 4. Validaciones
git add frontend/js/validations.js
git commit -m "feat(validations): validación en tiempo real y reglas de negocio"

# 5. Partidas y resultados
git commit --allow-empty -m "feat(matches): registro de partidas, MVP, K/D/A y tabla de posiciones"

# 6. Servicio de IA
git add frontend/js/aiService.js
git commit -m "feat(ai): servicio Gemini con generador local de respaldo"

# 7. Interfaz de crónicas
git commit --allow-empty -m "feat(chronicles): módulo de crónicas con botón copiar y estado de origen"

# 8. Documentación y evidencias
git add docs/EVIDENCIAS.md README.md
git commit -m "docs: README completo y guía de evidencias"
git remote add origin <URL-DEL-REPOSITORIO>
git push -u origin main
```

> Nota: como `app.js` e `index.html` se desarrollaron de forma integrada, los commits 5 y 7 pueden hacerse con `--allow-empty`, o bien dividiendo el trabajo real en commits parciales (`git add -p`) para que cada commit contenga solo los cambios de su etapa.

## 9. Pruebas manuales rápidas

Consulta [`docs/EVIDENCIAS.md`](docs/EVIDENCIAS.md) para la lista completa de casos de prueba y las capturas a incluir.

## 10. Posibles mejoras

- Generación automática de llaves (brackets) según el formato del torneo.
- Exportar e importar los datos en JSON.
- Backend intermediario para proteger la API Key.
- Pruebas automatizadas de las validaciones.
