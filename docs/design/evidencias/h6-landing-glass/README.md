# Landing 3107 · Comparación de logo y cristal

Capturas reales de Chromium. [Informe con archivos, dimensiones, tokens, pruebas y despliegue](../../H6_LANDING_LOGO_GLASS.md). Código desplegado `3ca1974f75844b6deb5034911298e97ca856548c`, rama `feat/h6-landing-access`. Fecha: 20 de noviembre de 2026, America/Bogota.

| Viewport | Claro antes | Claro después | Oscuro antes | Oscuro después |
| --- | --- | --- | --- | --- |
| 1920×1080 | [Antes](3107-before-light-wide.png) | [Login](3107-after-light-wide-login.png) · [Registro](3107-after-light-wide-register.png) | [Antes](3107-before-dark-wide.png) | [Login](3107-after-dark-wide-login.png) · [Registro](3107-after-dark-wide-register.png) |
| 1728×900 | [Antes](3107-before-light-large.png) | [Login](3107-after-light-large-login.png) · [Registro](3107-after-light-large-register.png) | [Antes](3107-before-dark-large.png) | [Login](3107-after-dark-large-login.png) · [Registro](3107-after-dark-large-register.png) |
| 1440×900 | [Antes](3107-before-light-desktop.png) | [Login](3107-after-light-desktop-login.png) · [Registro](3107-after-light-desktop-register.png) | [Antes](3107-before-dark-desktop.png) | [Login](3107-after-dark-desktop-login.png) · [Registro](3107-after-dark-desktop-register.png) |
| 1024×768 | [Antes](3107-before-light-landscape.png) | [Login](3107-after-light-landscape-login.png) · [Registro](3107-after-light-landscape-register.png) | [Antes](3107-before-dark-landscape.png) | [Login](3107-after-dark-landscape-login.png) · [Registro](3107-after-dark-landscape-register.png) |
| 768×1024 | [Antes](3107-before-light-tablet.png) | [Login](3107-after-light-tablet-login.png) · [Registro](3107-after-light-tablet-register.png) | [Antes](3107-before-dark-tablet.png) | [Login](3107-after-dark-tablet-login.png) · [Registro](3107-after-dark-tablet-register.png) |
| 390×844 | [Antes](3107-before-light-mobile.png) | [Login](3107-after-light-mobile-login.png) · [Registro](3107-after-light-mobile-register.png) | [Antes](3107-before-dark-mobile.png) | [Login](3107-after-dark-mobile-login.png) · [Registro](3107-after-dark-mobile-register.png) |

También se comprobó 320×812: [claro](3107-after-light-small-register.png) y [oscuro](3107-after-dark-small-register.png). Las imágenes son de página completa, con el viewport indicado en la tabla.

3100 intacto: [antes](3100-before-light-desktop.png) y [después](3100-after-light-desktop.png), idénticos por SHA-256. Solo se consultó en lectura.

- [Resumen](summary.json): tamaño/posición visible del logo, 0 px de variación de escritorio y reglas aprobadas conservadas.
- [Medidas iniciales](measurements-before.json) y [finales](measurements-after.json): caja, dibujo visible, separación y tokens computados.
- [Geometría login/registro](layout-geometry.json): escritorio estable; hasta 800 px se permite altura natural.
- [Transparencia real](transparency.json): la imagen educativa contribuye a los píxeles del interior del panel en ambos temas.
- [Contraste](contrast.json): 100 muestras aprobadas.
- [Build y pruebas unitarias](build.txt), [Playwright](playwright.txt) y [verificación de navegador](browser-verification.json).
- [Runtime inicial](runtime-before.json), [final](runtime-after.json), [conservación de los nueve servicios habituales](deployment-verification.json) y [equivalencia del entorno](environment-order.json), sin valores del entorno.

Los formularios y las redirecciones OIDC se probaron con respuestas interceptadas. No se crearon cuentas ni se ejecutaron sesiones reales. El PNG oficial y las funcionalidades de autenticación permanecen sin cambios.
