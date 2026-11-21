# H6-1: propuesta del Design System SIARE Académico

Estado: propuesta para revisión, posterior a la aprobación de H6-0. Fecha de referencia: 19 de noviembre de 2026, America/Bogota. H6-2 y H6-3 siguen sin autorización.

## Revisar el diseño

Abrir la [galería visual](h6-1/index.html) en un navegador. Incluye las dos alternativas, sus temas y dispositivos, enlaces a los prototipos y al [catálogo de componentes](h6-1/prototipo.html?screen=system&theme=light). Si el visor no ejecuta HTML, las [capturas PNG](evidencias/h6-1/README.md) permiten revisar los mismos diseños.

| Alternativa | Claro | Oscuro |
| --- | --- | --- |
| A: Cuaderno abierto | [Prototipo](h6-1/prototipo.html?layout=a&theme=light) | [Prototipo](h6-1/prototipo.html?layout=a&theme=dark) |
| B: Estudio en enfoque | [Prototipo](h6-1/prototipo.html?layout=b&theme=light) | [Prototipo](h6-1/prototipo.html?layout=b&theme=dark) |
| Catálogo | [Componentes claros](h6-1/prototipo.html?screen=system&theme=light) | [Componentes oscuros](h6-1/prototipo.html?screen=system&theme=dark) |

Son documentos interactivos locales sin backend. Los ejemplos de materia, fuentes, preguntas y estados son fixtures visuales identificadas como contenido de muestra. No se fabrican métricas, resultados, fechas del catálogo ni capacidad ML. El botón de terminar muestra el límite del prototipo, sin simular una evaluación aprobada por Spring.

## Identidad y decisiones

La propuesta conserva Urbanist local, naranja `#F58136`, pasteles cálidos y superficies translúcidas de Nexo. Los tokens originales y las capturas preservadas están en [H6_REFERENCIAS_NEXO.md](H6_REFERENCIAS_NEXO.md). NotebookLM orienta la separación entre fuentes, trabajo y herramientas; las funciones siguen siendo las de H3/H4.

| Decisión | Justificación y consecuencia |
| --- | --- |
| Naranja con tinta `#202020` | Preserva Nexo y permite contraste de texto normal. El blanco sobre ese naranja da 2,60:1 y queda descartado. |
| Dos tokens de acento | El fondo de acción conserva `#F58136`; enlaces, contornos de selección y foco usan variantes oscuras/claras de mayor contraste. |
| Glassmorphism en shell y paneles | Conserva identidad sin superponer capas translúcidas detrás del texto académico. Documento, formulario y opciones tienen una base más opaca. |
| Opacidad de superficie .82 claro / .88 oscuro | Aumenta legibilidad frente a .68 predeterminado del Nexo original. Se conserva el desenfoque de 26 px y una alternativa sólida. |
| Cuerpo de lectura 16 px | Adapta el cuerpo original Nexo de 14 px al estudio prolongado. Jerarquía académica contenida, sin grandes tarjetas promocionales en el centro. |
| Bordes de control más definidos | Los bordes decorativos pueden ser suaves; inputs, opciones y foco necesitan señales visibles. La acción naranja añade contorno de acento de texto. |
| Centro para la tarea activa | Quiz, lectura, banco, crucigrama y consulta comparten el área dominante. Estudio selecciona; no contiene el jugador completo. |
| Sin scroll interno obligatorio en el MVP | El documento puede desplazarse verticalmente y mantiene controles alcanzables; se evita encerrar el aprendizaje en una altura rígida. La variante con paneles desplazables requiere validación adicional en H6-3. |
| Fuentes con estados y selección explícitos | Texto e icono acompañan los colores. READY permite seleccionar; cuarentena y procesamiento no aparentan disponibilidad. |
| Carga bajo demanda y materia en opciones | Reduce el espacio que consume la administración antes de empezar a estudiar. Mantiene funciones de edición/archivo existentes. |

## Tokens de propuesta

[tokens.css](h6-1/tokens.css) es la referencia visual del prototipo. [tokens.json](h6-1/tokens.json) contiene las mismas variables organizadas como propuesta, sin integrarlas en Tailwind ni en `frontend/`. Ninguno está aprobado para uso productivo.

| Rol | Claro | Oscuro |
| --- | --- | --- |
| Acción de marca / hover / tinta | `#F58136` / `#FF954F` / `#202020` | Iguales |
| Lienzo / superficie sólida / elevada | `#F4F4F4` / `#F6F6F5` / `#EAE8E5` | `#242323` / `#292725` / `#35312E` |
| Texto / secundario / tenue | `#202020` / `#625E5C` / `#706C6A` | `#F1EFED` / `#C4BFBA` / `#B3ADA7` |
| Enlace / foco | `#9C4312` / `#A44714` | `#FFAE78` / `#FFA86E` |
| Superficie glass | `rgba(242,246,248,.82)` | `rgba(34,33,32,.88)` |
| Barra glass | `rgba(255,255,255,.74)` | `rgba(35,34,33,.82)` |
| Campo y opción | `rgba(255,255,255,.84)` | `rgba(49,46,43,.90)` |
| Borde decorativo / control | `rgba(66,48,37,.14)` / `#827872` | `rgba(255,246,238,.16)` / `#9D9188` |
| Selección | `rgba(245,129,54,.12)` | `rgba(245,129,54,.15)` |
| Rosa / menta | `#F6E2D2` / `#E1F0EA` | `#48372E` / `#303E37` |
| Crema / azul pastel | `#F3E7D1` / `#E3EAF2` | `#423B2D` / `#363B43` |
| Éxito texto / superficie | `#326448` / `#E5EEE8` | `#B8D9C2` / `#34483B` |
| Información texto / superficie | `#4D5C70` / `#E8EDF2` | `#CCD5DF` / `#363E47` |
| Advertencia texto / superficie | `#895014` / `#F8EADB` | `#E3C39D` / `#493A2D` |
| Error texto / superficie | `#9F3434` / `#F7E8E7` | `#F1AAAA` / `#482F2E` |

No se utiliza el pastel para identificar por sí solo el tipo o el resultado. El Quiz lleva nombre/icono además de rosa; el crucigrama, nombre/icono además de menta. El texto secundario conserva contraste frente a las superficies de lectura. Los estados de documentos conservan los nombres de backend y su traducción comprensible.

### Geometría, elevación y movimiento

| Token | Valor propuesto |
| --- | --- |
| Espaciado | 4, 8, 12, 16, 20, 24, 32, 40, 48 px |
| Radios | Insignia 8 px; campo/botón 12 px; panel 22 px; barra 28 px |
| Objetivo táctil | 44 × 44 px mínimo en controles operables; opciones con 60–66 px de altura mínima |
| Barra / encabezado escritorio | 84 / 64 px; margen y separación de 16 px |
| Tableta | Barra 64 px; márgenes/separación 12 px; encabezado 64 px |
| Móvil | Sin barra lateral; encabezado 58 px; márgenes 12 px, 8 px bajo 360 px |
| Iconos | 20 px general, 16–18 px auxiliar; trazo SVG 1,6 px; siempre nombre accesible en botón sin texto |
| Desenfoque | 26 px de referencia; superficie sólida como fallback |
| Sombra | Luz interior tenue y sombra exterior amplia con spread negativo; nada de resplandor naranja permanente |
| Transición breve / regular | 140 / 220 ms; `cubic-bezier(.2,.7,.2,1)` |
| Propiedades animadas | Color, borde y sombra en controles; transform/opacity solo si una transición de panel aporta orientación |
| Movimiento reducido | Sin animaciones/transiciones; sin shimmer ni desplazamientos automáticos decorativos |

No se añade GSAP. Los SVG del prototipo son geometría básica dibujada en el documento, no un paquete instalado ni una nueva marca aprobada. La “S” en el rail es un monograma provisional, con espacio equivalente al identificador Nexo. Urbanist y su OFL se copiaron sin cambiar desde el frontend existente; las referencias de H6-0 permanecen intactas.

### Tipografía

| Uso | Tamaño / línea | Peso | Aplicación |
| --- | --- | --- | --- |
| Display de catálogo | 36–40 / 43–48 px | 600 | Presentación del sistema, no preguntas ni estadísticas |
| Título de materia | 24–32 / 29–38 px | 600 | Una sola jerarquía principal; texto largo envuelve |
| Título de tarea | 22–28 / 27–34 px | 600 | Quiz, lectura, banco e intento |
| Pregunta | 20–24 / 29–35 px | 600 | Prioridad visual; longitud razonable y sin truncar |
| Texto académico | 16 / 24–29 px | 400–500 | Lectura y opciones en móvil |
| Control / etiqueta | 13–15 / 20–23 px | 600 | Texto de acciones y campos; campo editable 16 px |
| Ayuda / metadato significativo | 12–13 / 18–20 px | 500 | Estado documental, tipo y referencia |
| Microetiqueta de shell | 10–11 / 15–17 px | 600–700 | Solo orientación secundaria; nunca error, pregunta o instrucción esencial |

Tipografía fluida combina unidades `rem` y viewport con límites; no se usa `vw` aislado para el cuerpo. Mantener legibilidad con zoom real al 200 % es una condición futura, no una certificación de este prototipo. Párrafos entre 45–75 caracteres por línea cuando el espacio lo permita; no estirar automáticamente todo el texto hasta el borde del panel.

## Catálogo y estados

El [catálogo visual](h6-1/prototipo.html?screen=system&theme=light) reúne ocho secciones y funciona en ambos temas. Los estados mostrados son ejemplos visuales, no respuestas de servicios reales.

| Componente | Normal / hover / focus | Disabled / loading / error | Semántica y comportamiento previsto |
| --- | --- | --- | --- |
| Botón primario | Naranja/tinta; hover naranja claro; foco 3 px con offset 3 px | Disabled sólido neutro; loading con texto estable y `aria-busy`; error queda junto a la tarea | `button`, verbo concreto, una acción principal por contexto |
| Botón secundario/discreto/destructivo | Contorno de control o fondo transparente; destructivo con texto y borde de error | Inhabilitar mientras la operación lo exige; preservar error y recuperación | Cancelar no muta; confirmar espera respuesta real |
| Botón de icono | Área 44 px, icono 20 px, tooltip en hover/foco | Nombre accesible y estados pressed/expanded cuando correspondan | No usar `title` como único nombre; tooltip no sustituye texto crítico |
| Input/textarea | Etiqueta visible, contorno definido, foco sin saltar layout | Disabled nativo; `aria-invalid` y `aria-describedby`; mantener valores | Autocompletar apropiado en acceso; permitir pegar TOTP/contraseña |
| Select | Nativo, misma altura/radio; opciones con tema del navegador | Disabled y mensaje de validación por campo | No introducir selector custom solo por estética |
| Checkbox/radio | Nativos con `accent-color`; selección también por borde/etiqueta | `disabled` cuando el intento se congela | Etiqueta completa pulsable; probar indicadores en Safari |
| Grupo de vistas | Estado `aria-pressed`, contenedor tenue y foco visible | Bloqueos solo para acciones incompatibles con operación pendiente | En esta maqueta son botones de vista, no un tablist ARIA incompleto |
| Menú | Activador de 44 px y lista compacta; Escape/cierre | Acciones restringidas por permiso/pending | Catálogo usa popover nativo; fallback productivo aún por validar |
| Tooltip | Texto breve, mostrado también al enfocar | No contiene acciones ni instrucciones indispensables | Debe ser descartable, hoverable y persistente conforme a política accesible futura |
| Tarjeta/fila | Superficie única por contexto; selección con borde, texto e icono | Vacío, cargando, error recuperable y sin permiso distintos | No agrupar todo en tarjetas repetidas |
| Insignia | Texto + icono/tipo, pastel semántico | Estado real del servidor; no convertir “procesando” en progreso ficticio | No muestra porcentaje sin datos |
| Buscador de fuentes | Input con etiqueta y búsqueda local sobre lista disponible | Vacío de filtro distinguible de lista sin fuentes; reintento si falla carga | Sin endpoint de búsqueda inventado |
| Diálogo | `<dialog>` con título, foco, Escape y restauración | Cierre/acciones según pending; errores persistentes dentro del contexto | Demostración de archivo no ejecuta mutaciones |
| Aviso | Texto/icono y superficie semántica | Error importante no autocierra; éxito solo después del servidor | `status`/`alert` según urgencia, sin saturar lector |
| Progreso | Nativo, etiqueta explícita | Determinado solo con bytes/total; procesamiento indeterminado si no hay avance real | No animar por decoración |
| Lista/tabla | Cabecera y datos legibles, sin fecha ausente | Paginación de catálogo existente y controles ocupados | Tablas de datos requieren cabeceras; no inventar métricas |
| Resultado | Jerarquía para nota, aciertos, feedback, detalles y reintento | Espera/error/reintento distinguibles | Solo datos de `Evaluation` autorizado por Spring; en maqueta se muestra el estado sin evaluación |

El tooltip actual es una muestra visual y de foco: su tratamiento completo de Escape/hover y lector de pantalla queda pendiente antes de producción. Lo mismo ocurre con el popover y su fallback. No se declaran aprobados por haberlos dibujado.

## Temas y accesibilidad

Ambos temas tienen tokens explícitos. El oscuro conserva fondo cálido, pasteles contenidos, texto marfil y acento naranja; no es una inversión de color. El prototipo usa `<meta name="color-scheme">`, `color-scheme` en raíz y atributo `data-theme`, de modo que campos y scrollbars siguen el tema elegido. La preferencia por sistema, persistencia del ajuste y ausencia de flash se especifican para implementación posterior; aquí el tema se selecciona por URL o control de revisión.

Las medidas de contraste están en [contraste.json](evidencias/h6-1/contraste.json): pares semánticos opacos y composiciones alpha contra los fondos extremos declarados del diseño. No equivalen a auditoría WCAG completa de cada píxel, ni certifican Safari o lector de pantalla.

La propuesta usa foco visible, skip link, objetivos táctiles, `prefers-reduced-motion`, bordes del sistema en forced colors y una superficie sólida sin blur. No bloquea zoom. El prototipo fue redimensionado entre 320 y 1920 px y no presentó desbordamiento horizontal en las comprobaciones guardadas. La matriz completa de producción y el zoom real siguen pendientes.

## Funcionalidad y límites de entrega

No se modifica el código productivo ni sus contratos. H3 conserva Quiz/Crucigrama, bancos manuales/importados, revisión humana, selección READY, evaluación e idempotencia. H4 conserva documentos, C2PA/OCR, permisos, sesiones, MFA y OIDC. No se incorpora generación desde prosa, persistencia H5, historial general de intentos o V6. Los PR #8 y #9 permanecen independientes.

Los prototipos no implementan autenticación, procesamiento documental, guardado de banco, descarga, evaluación, rejilla completa de crucigrama ni reintentos de red. Sí permiten explorar temas, herramientas, paneles, selección local, escritura de un borrador, respuestas y diálogo. Recargar el HTML pierde su estado local; no se presenta como solución durable.

Los [riesgos y regresiones](H6_1_RIESGOS_Y_REGRESIONES.md) convierten la pérdida de borradores/respuestas en bloqueo de salida. La maqueta no corrige esos errores en SIARE.

## Skills y verificación

Se aplicaron `ui-ux-pro-max`, `modern-web-guidance` y [DakaDesing adaptado a SIARE](H6_SKILLS_SIARE.md). Se consultó `deslop` para los informes. No se modifican las skills globales ni se incorporan elementos de Ambrosia.

El generador UI/UX se consultó con `academic workspace glassmorphism` y, al resultar ajeno al producto, con `education productivity dashboard`. Devolvió patrones de landing/marketing y fuentes/paletas diferentes; no se adoptaron. La identidad proviene de Nexo, y se retienen como criterios útiles contraste, foco, reducción de movimiento y adaptación. La consulta `keyboard focus modal` apoyó los criterios de foco sin confundir AAA con AA.

### Modern Web Guidance

- `responsive-design`: combiné límites tipográficos con `rem`, alturas dinámicas y una vista móvil por panel, siguiendo “Use dynamic viewport units”. Evita imponer el alto del escritorio en el navegador móvil.
- `dark-mode`: declaré tema en raíz y canvas inicial, siguiendo “Apply the color-scheme property to the html element”. Los controles nativos acompañan la propuesta clara/oscura.
- `color`: distinguí contorno decorativo de control y añadí texto/iconos de estado, siguiendo “Don't use color alone”. Se documentan los pares medidos y los límites de la transparencia.

La [validación](evidencias/h6-1/README.md) distingue capturas del prototipo, controles medidos y pruebas productivas pendientes. No se hizo build, despliegue, commit, push o merge. Esta entrega visual y documental no requiere recrear contenedores, conforme a la excepción de `AGENTS.md` y a la restricción expresa del usuario.

## Resultado de la revisión local

Se generaron 24 capturas: las 12 combinaciones A/B, claro/oscuro y escritorio/tableta/móvil; catálogo y diálogo en ambos temas; y vistas adicionales de fuentes, banco, lectura, foco y galería. Chromium `153.0.8010.12` cargó Urbanist local sin errores JavaScript ni solicitudes HTTP/HTTPS.

Los 58 pares de contraste calculados superaron su objetivo (4,5:1 para texto normal, 3:1 para foco/contorno de control). La geometría revisada no mostró desbordamiento horizontal entre 320 y 1920 px. El recorrido local de respuesta/borrador, diálogo con Escape/restauración de foco y selector de tema pasó. Estas comprobaciones se limitan al prototipo documental.

Se verificó por hashes que H6-0, Urbanist/licencia y las skills originales permanecen intactos. El worktree conserva la base `c8f9344` y el cambio queda bajo `docs/design/`. La inspección Docker fue de lectura: nueve healthy, mismos IDs e imágenes que H6-0. No se volvió a ejecutar una suite de servicios ni se acredita un nuevo despliegue.

La decisión pendiente es aprobar o ajustar la identidad/componentes y elegir la alternativa de distribución para desarrollar después de la autorización correspondiente. Recomiendo A por el descubrimiento de fuentes y herramientas. La aprobación visual no elimina los bloqueos de [pérdida de trabajo](H6_1_RIESGOS_Y_REGRESIONES.md), ni autoriza automáticamente H6-2, H6-3 o una fusión.
