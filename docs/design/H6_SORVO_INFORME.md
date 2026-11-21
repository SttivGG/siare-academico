# H6: homologación visual integral con referencia Sorvo

Fecha: 21 de noviembre de 2026, America/Bogota. Preview: <http://127.0.0.1:3107>.
Rama: `feat/h6-sorvo-global`. Código desplegado: `ec146fb`.
Base del PR: `feat/h6-landing-access`, `123cc0b`.

El frontend comparte ahora fotografía, cristal, reflejos, bordes y sombras entre
landing, autenticación y áreas internas. Se conserva Urbanist, naranja `#F58136`,
PNG limpio y letras ámbar en oscuro. **Fuentes | Aprendizaje | Estudio** mantiene
sus tres slots, selector adaptable y estado académico.

El delta productivo modifica nueve archivos CSS. No cambia componentes React,
backend, BFF, migraciones, Flyway V6 ni generación ML. Los alias existentes de
tokens apuntan al [sistema compartido](H6_SORVO_SISTEMA.md).

## Comparación visual

Se abrió [Sorvo](https://demo.codeandchill.store/sorvo/#/home) en Chromium y se
capturaron ambos temas. La referencia se usa para comparación documental; el
producto no incorpora sus imágenes, código ni recursos gráficos.

| Aspecto | Sorvo observado | Landing e interiores de SIARE |
| --- | --- | --- |
| Profundidad | Bordes finos, reflejos superiores y sombras suaves | Base compartida de reflejo diagonal y sombra interior/exterior |
| Superficie | Cristal neutro sobre fondo con variaciones visibles | Panel principal al 28%, navegación al 56%; fotografía educativa perceptible |
| Color | Naranja de acción y neutros adaptados al tema | Naranja institucional; la foto conserva su color original, incluida su madera |
| Composición | Navegación flotante y densidad según la tarea | Rail/cabecera flotantes; Cuaderno aprobado; lectores con mayor contraste |
| Tipografía y contenido | Identidad editorial de la demo | Urbanist y funciones académicas existentes, sin métricas inventadas |

- Comparación [clara](evidencias/h6-sorvo/comparacion-light.jpg) y [oscura](evidencias/h6-sorvo/comparacion-dark.jpg): Sorvo, landing, dashboard, materias, Cuaderno y administración.
- Las 14 rutas en [claro](evidencias/h6-sorvo/rutas-light.jpg) y [oscuro](evidencias/h6-sorvo/rutas-dark.jpg).
- Estados con upstream aislado en [claro](evidencias/h6-sorvo/estados-light.jpg) y [oscuro](evidencias/h6-sorvo/estados-dark.jpg).
- [Galería y procedencia de evidencias](evidencias/h6-sorvo/README.md).

Se revisaron las composiciones anteriores y las capturas representativas a tamaño
completo. Las superficies principales transmiten el fondo y comparten el mismo
acabado. La lectura, los avisos y el diálogo usan variantes de mayor contraste;
su densidad responde a la tarea. La excepción sin transparencia corresponde al
fallback de accesibilidad o a navegadores sin filtro.

## Cobertura y pruebas

La [matriz de aceptación](H6_SORVO_ACEPTACION.md) y su [CSV](H6_MATRIZ_ACEPTACION.csv) conservan sus 50 casos: 14 rutas
y 36 estados internos. Actualiza las 100 referencias claras/oscuras y añade
procedencia, comparación, problemas y correcciones Sorvo. Conserva las columnas
históricas de H6-5 y los límites funcionales de cada caso.

| Verificación | Resultado |
| --- | --- |
| Unitarias y componentes | 45 pasan |
| Integración de producción Next con upstream aislado | 15 pasan: actividades, identidad y estados administrativos/seguridad |
| TypeScript y build Next | Pasan en host y en Dockerfile oficial |
| Playwright contra Docker 3107 | 101 casos únicos pasan; cinco omisiones móviles evitan duplicar matrices que ya incluyen móvil |
| ST-01 a ST-10 | Pasan en escritorio y móvil: borradores, herramientas, fuentes, respuestas, idempotencia, recuperación y cuentas |
| Responsive | 1920, 1440, 1366, 1024, 768, 390, 375 y 320 px; ambos temas; sin overflow en las matrices |
| Contraste renderizado | 658 muestras por línea de texto, sin muestras bajo el umbral aplicable |
| Transmisión óptica | 24 combinaciones; diferencia media mínima 18,05 niveles RGB al sustituir solo el fondo por una sonda de color |
| Accesibilidad automatizada | Foco, teclado, cancelación, valores retenidos, reduced motion, forced colors, tema sin JS, transparencia reducida y fallback sin blur |
| Verificación habitual | `Test-Siare.ps1` pasa; DOM y captura de 3100 coinciden exactamente con los anteriores |

La primera ejecución completa de Playwright produjo 98 éxitos, tres fallos y cinco
omisiones. Los tres fallos esperaban los colores cálidos retirados: uno de landing
y el caso sin JavaScript en dos proyectos. Se actualizaron esas expectativas y
los tres pasaron en la repetición dirigida. Se conservan [ambos registros](evidencias/h6-sorvo/playwright.txt)
y [la repetición](evidencias/h6-sorvo/playwright-recheck.txt); no se ocultó el fallo
inicial ni se volvió a probar innecesariamente toda la suite.

La prueba óptica oculta descendientes del panel sin cambiar su superficie y compara
una franja interior antes/después de sustituir la fotografía por una sonda. Una
tarjeta opaca no transmite esa variación. El contraste usa colores CSS contra
fondos renderizados con los glifos ocultos, por líneas de texto. En capturas largas
se oculta la barra móvil solo para muestrear el texto que se leería tras desplazarlo
por encima de ella. Estos muestreos no constituyen una certificación WCAG.

El [resumen verificable](evidencias/h6-sorvo/verification-summary.json) enlaza cada
ST y separa los resultados finales de las ejecuciones iniciales.

## Problemas encontrados y correcciones

Los interiores heredaban superficies casi opacas, un blur de 26 px y neutros cálidos.
Se sustituyeron por variantes semánticas neutrales, paneles al 28% y blur de 10 px.
La navegación usa 12 px. Se retiraron los filtros anidados de lectura y edición.

El muestreo inicial encontró textos secundarios insuficientes sobre la zona clara
de la foto. Se reforzaron texto, enlaces, instrucciones de Estudio, recuperación
local y pies de acceso. Los avisos comunes y badges usan una superficie neutral
de mayor contraste. El [registro inicial](evidencias/h6-sorvo/contrast-initial.json)
permite comparar esos problemas con la medición final sin fallos.

El fallback global necesitaba igualar la especificidad de los selectores de tema.
Ahora se aplica también en oscuro y sistema. La prueba extrae las declaraciones
reales del fallback y las ejecuta en Chromium; además emula la preferencia de
transparencia reducida mediante CDP. Se verifica que lectores y banco carecen de
su propio `backdrop-filter`.

## Docker y preservación

Al comenzar, los nueve contenedores habituales y la preview estaban detenidos.
El usuario autorizó arrancar los nueve existentes sin reconstruirlos y autorizó
los datos sintéticos persistentes de las suites. Se tomó la línea base después
del arranque y antes del despliegue. Los registros de prueba permanecen en la base
local; no se cambiaron cuentas existentes.

El proyecto activo es `siare-h6-3-validation`, servicio `frontend-h6`. Se conservaron
sus archivos Compose efectivos y se añadió únicamente una sobreescritura local
de imagen/etiquetas. Los controles oficiales comprobaron Docker, propiedad,
volúmenes exclusivos y configuración. Se ejecutó `up -d --no-deps --no-build
--pull never --wait --wait-timeout 120 frontend-h6` y se esperó **healthy**.

- Imagen desplegada: `siare-academico-frontend:h6-sorvo-global`.
- ID: `sha256:ca0266b8179115663532565932a509a57b10fe7d2e014ecfbb559baccd94c6d2`.
- Contenedor: `e10e8d8c4416`, `siare-h6-3-validation-frontend-h6-1`.
- Reversión: `siare-academico-frontend:h6-sorvo-rollback`, ID `sha256:3884bca1e9738cd2cc29c8c57c3c7c766ec1145c194ad7dd1e93249319207651`.

Los nueve contenedores habituales conservan ID, imagen, fecha de arranque,
configuración, entorno, mounts y redes respecto de la línea base. 3100 y 3107
responden UP. Se conservan `main`, `.env`, claves y assets por comprobación de
hashes. La preview no monta volúmenes. Docker representó las tres opciones DNS
vacías como `null` tras recrearla; reconstruirlas como `[]` reproduce exactamente
el hash HostConfig previo. El resto del HostConfig coincide.

Los [registros Docker](evidencias/h6-sorvo/deployment-verification.json) y la
[comparación del navegador habitual](evidencias/h6-sorvo/habitual-browser.json)
contienen los identificadores y comprobaciones. La imagen compila la aplicación;
reutiliza la capa npm de dependencias fijadas. No se hizo limpieza de Docker ni
se modificaron backend, redes o volúmenes persistentes.

## Pendientes H6-6

- Firefox/WebKit, lector de pantalla y teclado virtual físico. El 200% comprobado es tamaño de fuente; el zoom real del navegador sigue pendiente.
- Revalidar Google/GitLab externos y entrega SMTP con cuentas controladas. Las pruebas actuales cubren transporte y errores con respuestas controladas.
- Validar operaciones privilegiadas con una identidad administrativa de prueba autorizada. Las capturas ADMIN/SUPERADMIN proceden de upstream aislado; no acreditan una elevación real.
- Ampliar contraste a todos los estados y contenido extenso, y medir dispositivos físicos de pocos recursos. Las 658 muestras cubren seis pantallas en ambos temas y dos anchos.

El PR queda en draft, sin fusión automática. Su base conserva toda la cadena H6
y las correcciones de landing. Los cambios ajenos de la raíz y los demás worktrees
se mantienen fuera de esta rama.
