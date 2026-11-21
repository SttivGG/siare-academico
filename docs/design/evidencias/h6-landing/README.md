# Landing H6 · evidencia visual

Capturas de Chromium sobre la preview real `http://127.0.0.1:3107/`, antes y después. Páginas completas; los tamaños de la tabla corresponden al viewport. La pestaña de registro añade altura de forma natural.

| Vista | Antes claro | Después claro | Antes oscuro | Después oscuro |
| --- | --- | --- | --- | --- |
| Escritorio · 1440 × 1000 | [Antes](3107-before-light-desktop.png) | [Después](3107-after-light-desktop-login.png) | [Antes](3107-before-dark-desktop.png) | [Después](3107-after-dark-desktop-login.png) |
| Tableta · 768 × 1024 | [Antes](3107-before-light-tablet.png) | [Después](3107-after-light-tablet-login.png) | [Antes](3107-before-dark-tablet.png) | [Después](3107-after-dark-tablet-login.png) |
| Móvil · 390 × 844 | [Antes](3107-before-light-mobile.png) | [Después](3107-after-light-mobile-login.png) | [Antes](3107-before-dark-mobile.png) | [Después](3107-after-dark-mobile-login.png) |

Registro: [escritorio claro](3107-after-light-desktop-register.png), [escritorio oscuro](3107-after-dark-desktop-register.png), [tableta clara](3107-after-light-tablet-register.png), [tableta oscura](3107-after-dark-tablet-register.png), [móvil claro](3107-after-light-mobile-register.png), [móvil oscuro](3107-after-dark-mobile-register.png).

Ancho mínimo: [320 px claro](3107-after-light-small-register.png), [320 px oscuro](3107-after-dark-small-register.png). Las dos pestañas también se capturaron en ese ancho.

Instalación habitual: [3100 antes](3100-before-light-desktop.png), [3100 después](3100-after-light-desktop.png). Ambas imágenes tienen el mismo SHA-256: `8097cd4009d6178f04851a3ea54013cd241bedce9df001d8dccae84128676db1`. El HTML de `main` también coincide exactamente.

## Recursos locales

Logo oficial proporcionado por el usuario: `frontend/public/images/siare-logo.png`, copia íntegra de `SIARE_logo_frontend.png`. SHA-256: `a120d94b62431789671c20307a4f34e642c5ca935ca7a51f02d2dd08396280b7`. Se conserva el dibujo y se presenta sobre una base clara para que el nombre siga siendo legible en ambos temas.

Fondo: `frontend/public/images/study-background.webp`, 1536 × 1024, 62 294 bytes. Generado con la herramienta integrada `image_gen`, habilidad imagegen; convertido a WebP para el frontend, sin dependencias añadidas ni peticiones a proveedores de imágenes durante la navegación.

Prompt utilizado:

> Use case: photorealistic-natural. Asset type: background photograph for SIARE academic landing page. Generate a wide 3:2 landscape professional editorial photograph of a quiet digital study desk in a university library: open notebook, a few books, laptop without readable screen text, warm wood and softly blurred shelves. Calm, premium, natural soft side light, muted taupe charcoal warm cream and subtle burnt orange, low saturation. Composition: objects concentrated in lower left and outer edges, generous calm negative space centrally for website copy and access form. No people, no logos, no text, no watermarks, no bright glare. Real materials, understated educational atmosphere. This is a background asset, not a UI mockup.
