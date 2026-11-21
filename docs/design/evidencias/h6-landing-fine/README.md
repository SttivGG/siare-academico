# Landing 3107 · Capturas antes/después

Capturas de página completa sobre la instalación real. [Informe](../../H6_LANDING_AJUSTES_FINOS.md). Fecha de verificación: 20 de noviembre de 2026, America/Bogota.

| Vista | Claro antes | Claro después | Oscuro antes | Oscuro después |
| --- | --- | --- | --- | --- |
| Escritorio 1440×1000 | [Antes](3107-before-light-desktop.png) | [Login](3107-after-light-desktop-login.png) · [Registro](3107-after-light-desktop-register.png) | [Antes](3107-before-dark-desktop.png) | [Login](3107-after-dark-desktop-login.png) · [Registro](3107-after-dark-desktop-register.png) |
| Tableta 768×1024 | [Antes](3107-before-light-tablet.png) | [Login](3107-after-light-tablet-login.png) · [Registro](3107-after-light-tablet-register.png) | [Antes](3107-before-dark-tablet.png) | [Login](3107-after-dark-tablet-login.png) · [Registro](3107-after-dark-tablet-register.png) |
| Móvil 390×844 | [Antes](3107-before-light-mobile.png) | [Login](3107-after-light-mobile-login.png) · [Registro](3107-after-light-mobile-register.png) | [Antes](3107-before-dark-mobile.png) | [Login](3107-after-dark-mobile-login.png) · [Registro](3107-after-dark-mobile-register.png) |

Otros anchos comprobados en ambos temas y pestañas: 1280×900 (`compact`), 1024×768 (`landscape`) y 320×812 (`small`). Ejemplos: [1280 claro](3107-after-light-compact-register.png), [1024 oscuro](3107-after-dark-landscape-register.png), [320 claro](3107-after-light-small-register.png), [320 oscuro](3107-after-dark-small-register.png).

3100: [antes](3100-before-light-desktop.png) y [después](3100-after-light-desktop.png), idénticas por SHA-256.

- [Resumen de pruebas y estabilidad](summary.json): 0 px de variación geométrica entre tabs.
- [Medidas completas](layout-geometry.json): hero, cards, footer, panel, introducción, título y logo en las 24 combinaciones.
- [Transparencia y hash del PNG original](logo-alpha.json).
- [Contraste](contrast.json): 100 muestras aprobadas sobre fondos renderizados.
- [Despliegue y conservación de servicios habituales](deployment-verification.json).
- [Runtime inicial](runtime-before.json) y [final](runtime-after.json): hashes de configuración sin valores del entorno.
- [Build y 45 pruebas](build.txt), [Playwright final](playwright.txt) y [comprobación de navegador de 3100](browser-verification.json).

Los screenshots no incluyen credenciales ni cuentas. Los envíos de autenticación se interceptaron; no se alteraron datos persistentes.
