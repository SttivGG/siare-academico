# H6: navegación compacta y Apariencia

Implementación del 21 de noviembre de 2026, America/Bogota. Rama `feat/h6-navigation-appearance`, creada desde `8b6e35e13ee754aff8e480807ce2e59dcc7b54b2`, HEAD verificado del draft [#14](https://github.com/SttivGG/siare-academico/pull/14). El [PR draft #15](https://github.com/SttivGG/siare-academico/pull/15) apunta a `feat/h6-sorvo-global`; no se fusiona ningún PR.

## Navegación y cuenta

El rail ocupa x=0 y 100dvh en escritorio. La variable compartida `--rail-width` alterna 72/232 px y ajusta el grid del encabezado y contenido; se retira el límite centrado que separaba la navegación del viewport. La barra contraída muestra iconos con nombres accesibles y títulos. Expandida muestra los mismos destinos y permisos, en horizontal, y un control de contracción. La preferencia permanece entre rutas, recargas y pestañas. El cambio no utiliza claves React ni sustituye el árbol académico.

La cuenta está en el extremo inferior del rail. El disclosure nativo contiene identidad de sesión, seguridad, sesiones, apariencia y la operación de logout existente. Escape restaura el foco al activador; Tab recorre enlaces y acción, y cierra al salir; un clic exterior cierra el contenido. El menú se abre hacia la derecha en escritorio y encima del activador en móvil. Se conserva el bloqueo de envíos duplicados y la limpieza académica con su ruta de error si falla la eliminación de recuperación.

El encabezado mide 56 px y conserva breadcrumbs y un `ThemeControl compact` compartido, con sol/luna y área de 44 px. En móvil añade el botón de navegación. La navegación móvil se despliega bajo la cabecera y coloca la cuenta en su parte inferior. No reserva una columna de escritorio.

## Configuración funcional

`/configuracion/apariencia` pertenece al grupo protegido `(student)` y reutiliza la comprobación de identidad del servidor. Permite elegir Claro/Oscuro/Sistema y seis fondos locales; ajustar transparencia, blur y velo; y restaurar los cinco valores aprobados. La vista previa usa las mismas superficies reales. El cambio se aplica también a entrada, autenticación, seguridad, sesiones, administración, documentos y actividades mediante el layout raíz y los tokens globales.

| Preferencia | Predeterminado | Intervalo o alcance |
| --- | --- | --- |
| Tema | Sistema | `siare-theme` existente; sigue el sistema cuando no hay override |
| Fondo | Educación aprobado | Cinco imágenes y Sin imagen; identificadores autorizados |
| Transparencia | 72% | 20–72%; opacidad primaria 80–28%, navegación mínimo 56% |
| Blur | 10 px | 0–24 px; navegación 12 px por defecto, máximo 24 |
| Velo | 50% | 0–100%, alpha neutro acotado por tema; conserva color natural |

Restaurar mantiene el ancho elegido del rail y repone los cinco valores de la tabla. Lectura conserva 91% de opacidad y modales 86%; los campos mantienen su tratamiento semántico y no reciben blur propio. Las superficies anidadas tampoco añaden filtros.

`appearance-store` centraliza las suscripciones. La clave del tema se conserva como única fuente persistente de ese valor; `siare-appearance-v1` guarda versión, fondo, transparencia, blur, velo y densidad de navegación. Las dos claves son visuales y no contienen datos de sesión. El script previo al primer pintado comparte el normalizador con el runtime; una factoría autocontenida evita referencias rotas tras minificación. El almacenamiento solo acepta valores finitos acotados e identificadores conocidos.

Las preferencias pertenecen a este navegador/dispositivo, incluidas las pantallas públicas; no existe sincronización backend entre dispositivos. El evento `storage` sincroniza pestañas. Si el navegador bloquea el acceso o escritura, conserva el estado en memoria al navegar y muestra un único aviso global, fuera del encabezado. Al recargar con almacenamiento bloqueado vuelve a los valores disponibles. Las preferencias de transparencia reducida y colores forzados prevalecen sobre los controles; el fallback sin filtros conserva superficies legibles.

Para repetir sin escribir datos en Spring: `npm ci`, `npm run build`, `npm test`, `npm run typecheck` y `npm run test:e2e:appearance`, desde `frontend/`. Las integraciones se ejecutan con `npm run test:integration:activities`, `npm run test:integration:identity` y `npm run test:integration:nexo`. En Windows se usa `npm.cmd`. La suite aislada requiere Chromium/Chrome disponible en la ruta documentada por el config o `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Recursos y cobertura

Se incorporan cuatro fotografías Pexels verificadas, además del fondo educativo existente y Sin imagen. Las versiones completas suman 598.806 bytes; solo se solicita la seleccionada y las miniaturas usan carga diferida. [Licencias, autores y resoluciones](H6_APARIENCIA_RECURSOS.md); [metadatos exactos](evidencias/h6-appearance/assets.json).

El inventario vigente contiene **15 rutas de pantalla, 5 manejadores técnicos y 43 estados internos/transversales**, con **58 filas** en [la matriz](H6_MATRIZ_ACEPTACION.csv). Se añade R15 y AP01–AP07. Los informes anteriores conservan sus resultados históricos de 14 rutas, identificados como tales.

## Verificación y límites

El usuario eligió expresamente «Usar solo pruebas aisladas en memoria». Las pruebas autenticadas ejecutan Next de producción, BFF, componentes React, almacenamiento y cifrado reales contra un upstream HTTP de loopback con datos en memoria. La fixture vive exclusivamente en `frontend/tests/appearance-fixture.mjs`; Docker no la usa. Esta evidencia no acredita autorización o evaluación reales de Spring ni modifica las bases habituales.

TypeScript, build de producción y pruebas unitarias/componentes se ejecutan en el worktree. Las tres suites de integración usan upstreams controlados. Playwright usa Chromium instalado, seis tamaños solicitados, ambos temas y los dos estados de navegación adaptados. La primera matriz amplia detectó nueve muestras de contraste insuficiente con fotos nuevas y un selector de prueba obsoleto (`.quiz-player`). Se corrigió el selector a `.activity-player` y se fijaron mínimos de velo para las cuatro fotos nuevas. La repetición dirigida pasa; conserva [el registro inicial](evidencias/h6-appearance/background-contrast-initial.json). Las 912 muestras finales pasan en seis fondos, dos temas y 1440/390 px con transparencia 72%, blur cero y velo mínimo. La foto educativa conserva su tratamiento aprobado. La pasada final reúne **12 casos Playwright**, sin fallos, omisiones ni reintentos, y genera 40 capturas. Pasan **47 pruebas unitarias y de componentes** y **15 integraciones** (4 actividades, 6 identidad y 5 estados). También pasan TypeScript y build en host. [Resumen por ST-01 a ST-10](evidencias/h6-appearance/verification-summary.json), [matriz de 24 combinaciones](evidencias/h6-appearance/visual-matrix.json) y [reporte final Playwright](evidencias/h6-appearance/playwright.json). Los ST de envío/idempotencia se verifican en controlador e integración aislada; no se presentan como ejecución real de Spring.

La referencia [Sorvo](https://demo.codeandchill.store/sorvo/#/home) se abrió y capturó en Chromium. Se preservan Urbanist, naranja #F58136, cristal y workspace A. UI/UX Pro Max devolvió una propuesta genérica de landing con Inter/teal, que no se adopta; su consulta específica de teclado orientó foco y orden de Tab. DakaDesing se adapta según [la guía SIARE](H6_SKILLS_SIARE.md), conserva los diálogos nativos existentes y no requiere instalar SweetAlert2. Modern Web Guidance orientó el disclosure y el tema persistente. Se revisó la redacción con deslop.

Pendientes de alcance: Firefox/WebKit, lector de pantalla, zoom físico y rendimiento en dispositivos modestos. Los muestreos de contraste documentan sus combinaciones y no certifican WCAG. No se ejecutan Google/GitLab externos, SMTP ni operaciones administrativas con identidades reales.

## Preview y reversión

El único destino autorizado es `http://127.0.0.1:3107`, proyecto Compose `siare-h6-3-validation`, servicio `frontend-h6`. Se mantiene la configuración efectiva y se añade una sobreescritura de imagen/etiquetas. Los nueve servicios `siare-academico` de 3100 se conservan. El informe final registra imagen, contenedor, salud y comprobaciones de preservación.


## Capturas revisadas

Se inspeccionaron visualmente las capturas de referencia Sorvo, Apariencia en escritorio/móvil y claro/oscuro. Las 24 combinaciones incluyen seis tamaños y los dos estados de navegación; en móvil el segundo estado representa el drawer abierto. Se añaden [pantalla clara completa](evidencias/h6-appearance/appearance-complete-light.jpg), [oscura completa](evidencias/h6-appearance/appearance-complete-dark.jpg), [cuenta inferior](evidencias/h6-appearance/account-expanded.jpg), [galería](evidencias/h6-appearance/gallery-light.jpg), [transparencia](evidencias/h6-appearance/transparency-20-controls.jpg), [blur](evidencias/h6-appearance/blur-24-controls.jpg), [cuaderno](evidencias/h6-appearance/cuaderno-background.jpg) y [crucigrama](evidencias/h6-appearance/crossword-background-dark.jpg).

La relación de archivos y procedencia figura en [evidencias](evidencias/h6-appearance/README.md). El código fuente probado y destinado a la preview es `10c64ee651a2ed96663ee998110273c28a985363`; los commits posteriores de documentación no alteran el frontend de esa imagen.


## Despliegue verificado

El Dockerfile oficial ejecutó sus 47 pruebas, build y TypeScript sin fallos. La imagen utiliza la base Node fijada por digest y dependencias de lockfile; reutiliza la capa base, con instalación npm reconstruida por el script de prueba añadido al manifiesto. Se recreó únicamente `frontend-h6` con `--no-deps --no-build --pull never --wait --wait-timeout 120` y se esperó healthy. Las comprobaciones oficiales de propiedad, volúmenes exclusivos y configuración se ejecutaron antes de recrear.

| Registro | Resultado |
| --- | --- |
| Rama | `feat/h6-navigation-appearance` |
| Commit fuente de la imagen | `10c64ee651a2ed96663ee998110273c28a985363` |
| Imagen activa | `siare-academico-frontend:h6-navigation-appearance` |
| ID activo | `sha256:04a6543ae6ecd2cc5baf6c1df7eb2cf674ebf141a788e31c3bd24609799a0167` |
| Contenedor preview | `be7abd5f10ceba091fdbf171a47cfb7f2f8a4612e2b349900c7c03add753a276` |
| Proyecto / servicio | `siare-h6-3-validation` / `frontend-h6` |
| Salud | healthy; `GET http://127.0.0.1:3107/api/health` devuelve UP |
| Imagen de reversión | `siare-academico-frontend:h6-appearance-rollback-8b6e35e` |
| ID de reversión | `sha256:ca0266b8179115663532565932a509a57b10fe7d2e014ecfbb559baccd94c6d2` |
| Rama main conservada | `c8f934492f0cc7809282657270df34b4474915ca` |

La [comparación Docker](evidencias/h6-appearance/deployment-verification.json) confirma cero diferencias para los nueve servicios habituales en ID, imagen, arranque, salud y huellas de Config, HostConfig, montajes y redes. El archivo `.env` conserva su hash. No se modificaron servicios de datos, backend, Flyway, ML, volúmenes, redes, claves ni credenciales. `scripts/Test-Siare.ps1` pasa sus consultas autenticadas y los healthchecks de los nueve servicios. [Registro oficial](evidencias/h6-appearance/habitual-check.txt).

El navegador validó en el contenedor de 3107 la redirección de Apariencia sin sesión, preferencias públicas con recarga y sincronización, assets WebP servidos localmente, ausencia de errores JavaScript y tema oscuro del sistema sin JavaScript. También comprobó 1440/390/320 px en claro/oscuro. [Registro](evidencias/h6-appearance/preview-browser.json). La [comparación de 3100](evidencias/h6-appearance/habitual-browser.json) acredita igualdad exacta de DOM y píxeles en `/login` antes/después, además de título. Las 40 capturas autenticadas siguen identificadas como fixtures y no se presentan como login real en 3107.

Para revertir solo la preview, ejecutar desde la raíz habitual `pwsh -File .cache/h6-appearance/rollback-preview.ps1`. El script conserva los archivos Compose efectivos previos, añade `rollback.override.json`, usa la imagen funcional guardada y repite controles oficiales, recreación selectiva y espera healthy. Se preparó y validó la configuración; no se ejecutó la reversión. Los archivos locales de despliegue están en `.cache/h6-appearance/`; las evidencias versionadas contienen los identificadores y las comprobaciones sin variables secretas.


La rama publicada contiene el commit fuente `10c64ee` y el informe/evidencias en `81ed75e`, seguido del enlace al draft y normalización de espacios finales de los logs. El conector GitHub pudo leer #14, pero devolvió 403 al crear el PR; la CLI local autenticada creó el draft #15 con la misma base y descripción. #14 permanece abierto y sin cambios.
