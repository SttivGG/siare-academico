# Evidencias de homologación Sorvo / SIARE

Código productivo: `ec146fb`, rama `feat/h6-sorvo-global`. Las capturas de
`final/`, `rutas/`, `landing/`, `cuaderno/` y `optica/` proceden de la preview
Docker <http://127.0.0.1:3107>. Se usan cuentas y materiales sintéticos autorizados.

| Carpeta o archivo | Procedencia y alcance |
| --- | --- |
| `referencia/` | Capturas de la demo pública Sorvo en claro/oscuro; solo comparación documental |
| `before/` | Preview anterior con landing aprobada y superficies internas heredadas |
| `final/` | Comparación representativa del frontend desplegado: landing, dashboard, materias, Cuaderno, seguridad y acceso |
| `rutas/` | Las 14 rutas, cuenta, menú móvil, not-found, forced colors y validación geométrica de ocho tamaños |
| `landing/` | Acceso/registro, siete tamaños, ambos temas; disponibilidad real inicial de proveedores |
| `cuaderno/desktop/` y `cuaderno/mobile/` | Ocho estados académicos, ambos temas y ocho tamaños; fuente, lectura, banco, Quiz, Crucigrama, evaluación y recuperación |
| `real/` | Capturas de suites con Spring real: errores, MFA USER, sesiones, búsqueda y estados vacíos. Secretos de enrolamiento y contraseñas enmascarados |
| `estados/` | Datos académicos reales con esperas de transporte y un error controlado por Playwright; carga, procesamiento, envío, intento y archivo |
| `controlado/` | Build Next final contra servidor HTTP aislado: ADMIN/SUPERADMIN, conflictos, parámetros, auditoría, errores de identidad/MFA/recuperación y diálogos |
| `optica/` | 24 combinaciones de transmisión del fondo y 658 muestras de contraste por línea; capturas de seis pantallas en ambos temas y dos anchos |
| `playwright.json` / `playwright.txt` | Ejecución completa: 98 éxitos, tres expectativas obsoletas de color y cinco omisiones |
| `playwright-recheck.json` / `.txt` | Repetición de esas expectativas corregidas: tres éxitos y una omisión móvil redundante |
| `verification-summary.json` | Resultado consolidado de los 106 casos únicos: 101 pasan, cinco omiten repetir matrices; trazabilidad ST-01 a ST-10 |
| `componentes.txt`, `integracion.txt`, `build.txt`, `typescript.txt` | Resultados finales del host; Dockerfile ejecuta además unitarias/build/TypeScript antes de crear la imagen |
| `runtime-before.json` / `runtime-after.json` | IDs, imágenes y hashes de configuración sin variables de entorno en claro |
| `deployment-verification.json` | Salud, reversión y preservación de los nueve contenedores habituales; normalización DNS vacía de la preview |
| `habitual-browser.json`, `3100-before.png`, `3100-after.png` | Misma captura por SHA-256, mismo DOM y salud UP de 3100 |
| `contrast-initial.json` | Problemas encontrados antes de corregir contraste. No representa el resultado final |

Las comparaciones [clara](comparacion-light.jpg) y [oscura](comparacion-dark.jpg)
permiten revisar Sorvo, landing e interiores juntos. Las hojas de rutas y estados
resumen el conjunto; los enlaces de la [matriz](../../H6_MATRIZ_ACEPTACION.csv)
abren cada captura completa.

Las capturas largas conservan la barra móvil fija en la posición de viewport que
tenía al capturar. El espacio fuera del viewport puede mostrar el canvas neutro
porque la fotografía es una capa fija. Esto no representa pérdida del fondo al
desplazarse en el navegador. La geometría y el estado se probaron en la aplicación
activa, no mediante comparación de imágenes únicamente.

La administración controlada no acredita permisos privilegiados reales, y una
pantalla de error OIDC no acredita un login con el proveedor externo. Los límites
manuales pendientes se detallan en [el informe](../../H6_SORVO_INFORME.md).
