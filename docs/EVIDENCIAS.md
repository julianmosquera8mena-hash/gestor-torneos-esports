# Evidencias de funcionamiento

Guía para documentar y probar el **Gestor de Torneos de Esports**. Guarda las capturas en `docs/capturas/` (créala si no existe) con los nombres sugeridos y enlázalas en este archivo con `![descripción](capturas/nombre.png)`.

**Preparación:** abre `frontend/index.html`, pulsa **Restaurar datos de prueba** y confirma, para que todos partan del mismo estado (2 torneos, 4 equipos, 2 partidas).

---

## 1. Capturas a incluir

| # | Archivo sugerido | Qué debe verse |
|---|---|---|
| 1 | `01-dashboard.png` | Dashboard con el marcador de la última partida, cifras, torneos en juego y tabla de posiciones. |
| 2 | `02-torneos.png` | Vista Torneos con el formulario y los dos torneos precargados (estados y equipos inscritos). |
| 3 | `03-equipos.png` | Vista Equipos con los 4 equipos y los formularios de registro e inscripción. |
| 4 | `04-partidas.png` | Vista Partidas con las 2 partidas jugadas, MVP y K/D/A. |
| 5 | `05-validacion-torneo.png` | Formulario de torneo con errores en rojo al enviar vacío. |
| 6 | `06-validacion-duplicado.png` | Error al inscribir un equipo ya inscrito o al registrar un equipo con nombre/tag repetido. |
| 7 | `07-validacion-partida.png` | Errores de marcador negativo, equipos iguales o empate. |
| 8 | `08-cronica-local.png` | Crónica generada **sin API Key** con la etiqueta «Modo respaldo local». |
| 9 | `09-cronica-gemini.png` | Crónica generada **con API Key** y la etiqueta «Generado con Gemini» (opcional si no se dispone de clave). |
| 10 | `10-fallback-error.png` | Clave inválida o sin conexión: aviso del motivo y resultado en modo local. |
| 11 | `11-movil.png` | Vista en ancho móvil (DevTools → modo dispositivo) con la barra de navegación inferior. |
| 12 | `12-localstorage.png` | DevTools → Application → Local Storage con la clave `arena.gestorTorneos.v1`. |

---

## 2. Casos de prueba

Marca cada caso con ✅ o ❌ y anota observaciones.

### 2.1 Navegación
| Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|
| N-01 | Pulsar cada pestaña del menú. | Cambia la vista sin recargar la página; la URL cambia a `#/...`. | |
| N-02 | Recargar estando en `#/equipos`. | Se mantiene la vista de Equipos. | |
| N-03 | Pulsar «Generar crónica» en una tarjeta de partida. | Abre Crónicas IA con esa partida preseleccionada. | |

### 2.2 Persistencia
| Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|
| P-01 | Crear un torneo y recargar (F5). | El torneo sigue en la lista. | |
| P-02 | Pulsar «Restaurar datos de prueba». | Vuelven 2 torneos, 4 equipos y 2 partidas. | |

### 2.3 Torneos
| Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|
| T-01 | Enviar el formulario vacío. | Errores en nombre, videojuego, formato, fecha y premio; foco en el primero. | |
| T-02 | Crear «Copa Andina Valorant 2026». | Error: ya existe un torneo con ese nombre. | |
| T-03 | Crear un torneo válido. | Aparece con estado **Abierto** y aviso de éxito. | |
| T-04 | Cambiar el estado desde la tarjeta. | El badge se actualiza y se guarda. | |
| T-05 | Poner en «Abierto» un torneo con partidas. | Rechazado con mensaje de error. | |

### 2.4 Equipos e inscripciones
| Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|
| E-01 | Registrar un equipo con tag `A`. | Error: el tag debe tener de 2 a 5 caracteres. | |
| E-02 | Registrar un equipo con nombre «Nova Esports». | Error: nombre duplicado. | |
| E-03 | Registrar un equipo con tag `nva`. | Se convierte a mayúsculas y da error por tag repetido. | |
| E-04 | Inscribir «Nova Esports» en «Copa Andina Valorant 2026». | Error: el equipo ya está inscrito. | |
| E-05 | Elegir el torneo «Liga Bogotá Invitational de LoL». | No aparece en la lista de torneos (está Finalizado). | |
| E-06 | Intentar eliminar «Nova Esports». | Rechazado: el equipo tiene partidas registradas. | |

### 2.5 Partidas
| Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|
| M-01 | Marcador A = `-1`. | Error: no puede ser negativo. | |
| M-02 | Marcadores `10` y `10`. | Error: no puede terminar empatado. | |
| M-03 | Equipo A = Equipo B. | Error: un equipo no puede enfrentarse a sí mismo. | |
| M-04 | Seleccionar un torneo sin equipos. | El selector de equipos indica «Inscribe equipos primero». | |
| M-05 | Registrar una partida válida en un torneo Abierto. | Se agrega a la lista y el torneo pasa a **En curso**. | |
| M-06 | Revisar el Dashboard tras registrar la partida. | Cambian la última partida, las cifras y la tabla de posiciones. | |

### 2.6 Crónicas con IA
| Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|
| IA-01 | Sin API Key, elegir una partida y generar. | Post y crónica generados; etiqueta «Modo respaldo local». | |
| IA-02 | Generar de nuevo la misma partida. | El texto es idéntico (generador determinista). | |
| IA-03 | Probar la partida de LoL (78 min, 2-1) y la de Valorant (43 min, 13-9). | La narración cambia según duración y marcador. | |
| IA-04 | Modo «Datos rápidos» con datos incompletos. | Errores de validación; no se genera nada. | |
| IA-05 | Modo «Datos rápidos» con datos válidos. | Se generan los dos bloques sin registrar la partida. | |
| IA-06 | Pulsar «Copiar texto» en cada bloque. | Aviso de copiado; al pegar aparece el texto. | |
| IA-07 | Escribir una API Key inválida y generar. | Se activa el modo respaldo y se muestra el motivo. | |
| IA-08 | Desactivar la red (DevTools → Network → Offline) con una clave. | Se activa el modo respaldo local. | |
| IA-09 | Usar una API Key válida de Gemini. | Etiqueta «Generado con Gemini»; texto basado en los datos de la partida. | |
| IA-10 | Cerrar la pestaña y volver a abrir. | La API Key ya no está guardada (`sessionStorage`). | |

### 2.7 Responsive y accesibilidad
| Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|
| R-01 | Reducir el ancho a ~375 px. | Formularios en una columna; navegación inferior; sin desplazamiento horizontal. | |
| A-01 | Navegar solo con el teclado (Tab). | Foco visible; el enlace «Saltar al contenido» aparece al primer Tab. | |

---

## 3. Datos de prueba para generar crónicas

**Partida corta y dominante (modo rápido):**
Equipo A `Phoenix Rising`, Equipo B `Lobos del Norte`, juego `Valorant`, marcador `13 - 3`, duración `22`, MVP `Zeta`, K/D/A `24 / 8 / 5`, objetivos `7`.

**Partida larga y ajustada (modo rápido):**
Equipo A `Titanes del Sur`, Equipo B `Neon Wolves`, juego `League of Legends`, marcador `2 - 1`, duración `84`, MVP `Luna`, K/D/A `6 / 5 / 29`, objetivos `16`.

---

## 4. Registro de resultados

| Fecha | Navegador / versión | Casos probados | Casos fallidos | Observaciones |
|---|---|---|---|---|
| | | | | |
