# Landing: composición y cristal transparente

Preview: <http://127.0.0.1:3107/>. Rama: `feat/h6-landing-access`.
Código desplegado: `2431547` (incluye `41a66a1`). Sin fusión ni publicación remota.

## Resultado visual

El acceso queda a la derecha, con bienvenida arriba y formulario debajo. El PNG
original conserva transparencia y proporciones; su marco de presentación crece
de 340 a 576 px a 1440 px, y de 360 a 640 px a 1920 px. En escritorio empieza
16 px más a la izquierda. A 1440 px el acceso pasa de x=460 a x=862,4.

Se retira la escala de grises de la fotografía original y se aplica un degradado
lateral de neutros y carbón. Se mantiene el color propio de plantas, libros y
madera, sin añadir una capa café. En tableta y móvil, el encuadre conserva las
estanterías detrás del formulario.

El panel combina tinte al 28%, desenfoque de 10 px, reflejo diagonal, borde
translúcido y sombra suave. Se distinguen estanterías y mesa a través del vidrio.
Tema claro y oscuro adaptan superficie, campos, texto, bordes y estados. Los
enlaces y el subtítulo del logo tienen contraste reforzado en tema claro. Para
navegadores sin desenfoque de fondo se conserva una superficie legible de respaldo.

No cambian los estilos de las cards inferiores, los textos base, el toggle, los
proveedores ni la lógica de autenticación. La fotografía y el PNG son los mismos
archivos, verificados por hash.

## Evidencia

- [Comparación en oscuro](evidencias/h6-landing-crystal/comparacion-dark.jpg).
- [Comparación en claro](evidencias/h6-landing-crystal/comparacion-light.jpg).
- [Escritorio amplio](evidencias/h6-landing-crystal/3107-after-dark-wide-login.png).
- [Tableta en claro](evidencias/h6-landing-crystal/3107-after-light-tablet-register.png).
- [Móvil en oscuro](evidencias/h6-landing-crystal/3107-after-dark-mobile-register.png).
- [Resumen de validación](evidencias/h6-landing-crystal/validation-summary.json).

Las capturas proceden de Chromium sobre la preview desplegada. La referencia
Sorvo no estuvo accesible: la consulta web falló y el navegador agotó el tiempo
de navegación. El ajuste se revisó contra los requisitos visuales del brief.

## Validación del despliegue

El Dockerfile ejecutó las 45 pruebas unitarias, `next build` y `tsc --noEmit`.
Playwright validó 11 casos; se omite una repetición móvil porque la matriz del
primer caso ya incluye 1920, 1728, 1440, 1024, 768, 390 y 320 px, ambos temas
y ambas pestañas. Las 28 combinaciones no presentan desbordamiento ni errores
de JavaScript; la posición y altura permanecen iguales al alternar las pestañas.
Las solicitudes de envío, errores y redirecciones de autenticación se prueban
con respuestas controladas; la disponibilidad inicial de proveedores se consulta
al servicio real. No se crean cuentas ni sesiones reales.

Se verifican 216 muestras de contraste en 1440 y 390 px, ambos temas y pestañas,
sin muestras por debajo del umbral de texto correspondiente. También pasan la
navegación por teclado y los colores forzados. Es una comprobación de esas
muestras, no una auditoría completa de accesibilidad.

La prueba óptica cambia solo la capa fotográfica por un fondo de diagnóstico y
compara una franja vacía dentro del panel renderizado. En los cuatro casos
(1440/390 px, claro/oscuro), más del 85% de canales muestreados cambian más de
5 niveles RGB: el fondo se transmite a través del panel. Los recortes y mediciones
están en [glass-optics.json](evidencias/h6-landing-crystal/glass-optics.json).

## Instalación y preservación

Proyecto Compose `siare-h6-3-validation`, servicio `frontend-h6`. Se conservaron
los archivos Compose activos, añadiendo `.cache/h6-landing-crystal/preview.override.json`
para imagen y etiquetas. Se ejecutaron los controles oficiales de Docker,
propiedad, volúmenes exclusivos y configuración, y después `up -d --no-deps
--no-build --pull never --wait --wait-timeout 120 frontend-h6`.

- Imagen: `siare-academico-frontend:h6-landing-crystal`.
- ID: `sha256:ca59092ea6e363652702f4eb352d11c1b4bc8d21cbf3b4130ecc35ad64c4413b`.
- Contenedor: `b648a1dddf34`, `siare-h6-3-validation-frontend-h6-1`, **healthy**.
- Reversión conservada: `siare-academico-frontend:h6-landing-crystal-rollback`,
  `sha256:7f71a64b93e6d27e6785d8cee70572e78d7a85ccbfb8f228dd2704adb544a1ed`.

3100 conserva su contenedor `eae9ae80e3c1`, imagen y fecha de inicio, junto a los
otros ocho servicios habituales. Su DOM y captura antes/después son idénticos.
Ambos `/api/health` responden HTTP 200 / `UP`. Se verificaron configuración,
variables, mounts y redes, sin modificación de `.env`, `main`, volúmenes,
credenciales o cambios ajenos del checkout principal. El registro completo está
en [deployment-verification.json](evidencias/h6-landing-crystal/deployment-verification.json)
y [habitual-browser.json](evidencias/h6-landing-crystal/habitual-browser.json).
