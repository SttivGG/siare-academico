# Evidencias de navegación y Apariencia

Las 40 capturas JPG de este directorio se generaron con Chromium y Next de producción, usando exclusivamente un upstream HTTP aislado en memoria. Las identidades y materias son fixtures. No se escribieron datos en Spring ni en sus bases. La salud y el acceso público de la preview desplegada se documentan por separado.

- `visual-matrix.json`: 24 combinaciones de seis viewports, dos temas y dos estados adaptados. En escritorio la geometría acredita x=0, 100dvh, 72/232 px y encabezado de 56 px; en móvil el segundo estado abre el drawer.
- `appearance-*.jpg`: matriz de 1920×1080, 1440×900, 1024×768, 768×1024, 390×844 y 320×844. Las dos `appearance-complete` contienen la pantalla completa.
- `account-*.jpg`: cuenta abierta junto al extremo inferior del rail.
- `gallery-*.jpg`: seis opciones, ambos temas.
- `transparency-*` y `blur-*`: superficie y controles en sus límites.
- `cuaderno-background.jpg` y `crossword-background-dark.jpg`: fotografía aplicada a componentes académicos reales con estado retenido.
- `playwright.json`: 12 casos finales pasan, sin omisiones ni reintentos. `playwright-initial.json` conserva la matriz inicial con dos fallos posteriormente corregidos.
- `background-contrast.json`: 912 muestras, seis fondos, ambos temas, 1440/390 px y los ajustes menos protectores; sin muestras bajo el umbral. `background-contrast-initial.json` conserva las nueve muestras que motivaron los mínimos de velo para fotografías nuevas.
- `sorvo-contrast.json` y `sorvo-glass-optics.json`: regresión de seis superficies globales, ambos temas y escritorio/móvil; 24 sondas ópticas. No constituye certificación WCAG.
- `assets.json`: autor, licencia, origen, resolución original, recorte y tamaños de cada recurso fotográfico añadido.

Las capturas de administración y seguridad de la integración controlada se conservan en la caché del worktree (`.cache/h6-4-controlled`); sus roles ADMIN/SUPERADMIN son simulados y no prueban elevación de permisos real. Los [resultados y límites](../../H6_APARIENCIA_INFORME.md) distinguen cada capa.


`preview-public-*.jpg` y `preview-browser.json` pertenecen al contenedor desplegado en 3107, usando páginas públicas sin iniciar sesión. `habitual-before.png` y `habitual-after.png` son las capturas idénticas de 3100. `deployment-verification.json` solo guarda identificadores y huellas; no publica entornos ni credenciales. `docker-build.txt`, `deploy.txt` y `habitual-check.txt` contienen el build oficial, la recreación selectiva y los controles finales.
