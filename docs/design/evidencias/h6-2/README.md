# Evidencias H6-2

Capturas de la aplicación Next.js real en Docker aislado, 127.0.0.1:3107. Revisión de runtime `1931ddbcf177fbfe3ffbb4b8041a4335fd601edb`. Chromium 153.0.8010.12; cuentas y materiales sintéticos. Los nombres indican viewport CSS; las imágenes de página completa pueden ser más altas.

No acreditan despliegue H6 sobre 3100 ni cierre de los casos pendientes de H6-3/H6-4. La captura `habitual-3100-login.png` muestra expresamente la instalación H4 preservada.

| Pantalla | Claro escritorio | Oscuro escritorio | Tableta claro / oscuro | Móvil claro / oscuro |
| --- | --- | --- | --- | --- |
| R01 Bienvenida | [Ver](R01-light-1440x900.png) | [Ver](R01-dark-1440x900.png) | [Claro](R01-light-768x1024.png) / [Oscuro](R01-dark-768x1024.png) | [Claro](R01-light-390x844.png) / [Oscuro](R01-dark-390x844.png) |
| R02 Login | [Ver](R02-light-1440x900.png) | [Ver](R02-dark-1440x900.png) | [Claro](R02-light-768x1024.png) / [Oscuro](R02-dark-768x1024.png) | [Claro](R02-light-390x844.png) / [Oscuro](R02-dark-390x844.png) |
| R03 Registro | [Ver](R03-light-1440x900.png) | [Ver](R03-dark-1440x900.png) | [Claro](R03-light-768x1024.png) / [Oscuro](R03-dark-768x1024.png) | [Claro](R03-light-390x844.png) / [Oscuro](R03-dark-390x844.png) |
| R04 Recuperación | [Ver](R04-light-1440x900.png) | [Ver](R04-dark-1440x900.png) | [Claro](R04-light-768x1024.png) / [Oscuro](R04-dark-768x1024.png) | [Claro](R04-light-390x844.png) / [Oscuro](R04-dark-390x844.png) |
| R05 Nueva contraseña | [Ver](R05-light-1440x900.png) | [Ver](R05-dark-1440x900.png) | [Claro](R05-light-768x1024.png) / [Oscuro](R05-dark-768x1024.png) | [Claro](R05-light-390x844.png) / [Oscuro](R05-dark-390x844.png) |
| R06 MFA | [Ver](R06-light-1440x900.png) | [Ver](R06-dark-1440x900.png) | [Claro](R06-light-768x1024.png) / [Oscuro](R06-dark-768x1024.png) | [Claro](R06-light-390x844.png) / [Oscuro](R06-dark-390x844.png) |
| R07 Renovación | [Ver](R07-light-1440x900.png) | [Ver](R07-dark-1440x900.png) | [Claro](R07-light-768x1024.png) / [Oscuro](R07-dark-768x1024.png) | [Claro](R07-light-390x844.png) / [Oscuro](R07-dark-390x844.png) |
| R08 Inicio | [Ver](R08-light-1440x900.png) | [Ver](R08-dark-1440x900.png) | [Claro](R08-light-768x1024.png) / [Oscuro](R08-dark-768x1024.png) | [Claro](R08-light-390x844.png) / [Oscuro](R08-dark-390x844.png) |
| R09 Materias | [Ver](R09-light-1440x900.png) | [Ver](R09-dark-1440x900.png) | [Claro](R09-light-768x1024.png) / [Oscuro](R09-dark-768x1024.png) | [Claro](R09-light-390x844.png) / [Oscuro](R09-dark-390x844.png) |
| R10 Crear materia | [Ver](R10-light-1440x900.png) | [Ver](R10-dark-1440x900.png) | [Claro](R10-light-768x1024.png) / [Oscuro](R10-dark-768x1024.png) | [Claro](R10-light-390x844.png) / [Oscuro](R10-dark-390x844.png) |
| R11 Workspace (integración H6-3 pendiente) | [Ver](R11-light-1440x900.png) | [Ver](R11-dark-1440x900.png) | [Claro](R11-light-768x1024.png) / [Oscuro](R11-dark-768x1024.png) | [Claro](R11-light-390x844.png) / [Oscuro](R11-dark-390x844.png) |
| R12 Seguridad | [Ver](R12-light-1440x900.png) | [Ver](R12-dark-1440x900.png) | [Claro](R12-light-768x1024.png) / [Oscuro](R12-dark-768x1024.png) | [Claro](R12-light-390x844.png) / [Oscuro](R12-dark-390x844.png) |
| R13 Sesiones | [Ver](R13-light-1440x900.png) | [Ver](R13-dark-1440x900.png) | [Claro](R13-light-768x1024.png) / [Oscuro](R13-dark-768x1024.png) | [Claro](R13-light-390x844.png) / [Oscuro](R13-dark-390x844.png) |
| R14 Administración (USER denegado) | [Ver](R14-light-1440x900.png) | [Ver](R14-dark-1440x900.png) | [Claro](R14-light-768x1024.png) / [Oscuro](R14-dark-768x1024.png) | [Claro](R14-light-390x844.png) / [Oscuro](R14-dark-390x844.png) |
| X02 404 | [Ver](X02-light-1440x900.png) | [Ver](X02-dark-1440x900.png) | [Claro](X02-light-768x1024.png) / [Oscuro](X02-dark-768x1024.png) | [Claro](X02-light-390x844.png) / [Oscuro](X02-dark-390x844.png) |

## Estados específicos

- Diálogo: [claro](W13-light-1440x900.png), [oscuro](W13-dark-1440x900.png). Escape/Cancelar sin PATCH y restauración de foco probados.
- [Menú de cuenta](I01-light-1440x900.png), con identidad de prueba y formulario conservado.
- [OIDC con fallo controlado](A03-light-1440x1000-error.png), [móvil](A03-light-375x812-error.png).
- [Texto documental y original](W05-light-1440x1000-texto.png), [móvil](W05-light-375x812-texto.png).
- [Evaluación de Spring de actividad sintética](W11-light-1440x1000-evaluacion.png), [móvil](W11-light-375x812-evaluacion.png).
- [Colores forzados y movimiento reducido](X06-forced-colors-reduced-motion.png).
- Tema oscuro sin JavaScript: [escritorio](sin-js-dark-desktop.png), [móvil](sin-js-dark-mobile.png).
- [Instalación habitual H4 en 3100](habitual-3100-login.png), conservada.

## Registros

- [Validación visual](validacion.json): 240 mediciones, ocho tamaños, ambos temas.
- [Contraste](contraste.json): 72 pares/compuestos de producción.
- [Pruebas Playwright](pruebas.json): resultados por caso y omisiones explícitas.
- [Runtime](runtime.json): imágenes, contenedores, salud y volúmenes sin secretos.
- [Navegador habitual](habitual-browser.json): H4 sigue activo en 3100.
- [Cobertura](cobertura.json): 14 páginas, 5 rutas técnicas y 36 casos.

## Comparación y límites

Se contrastaron las capturas con Nexo original y el prototipo A conservados en `../h6-0/` y `../h6-1/`. Coinciden fuente, paleta, separación de acento de acción/texto, rail y encabezado. El workspace todavía conserva el layout académico heredado: el centro A, la continuidad al cambiar herramientas y la recuperación durable son tareas H6-3 bloqueantes. No se certifican por estas capturas.

No se probaron teléfono físico/teclado virtual, lector de pantalla, zoom real 200 %, Firefox/WebKit ni todos los estados privilegiados. El control de contraste mide pares y composiciones declaradas, no todos los píxeles ni conformidad WCAG completa.
