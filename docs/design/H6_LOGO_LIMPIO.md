# Logo: limpieza de transparencia y reducción

Preview actualizada: <http://127.0.0.1:3107/>. Rama `feat/h6-landing-access`.
Código desplegado: `db823a8`.

## Diagnóstico y recurso usado

`Pictures/SIARE_logo_frontend.png` y el PNG original del repositorio son idénticos:
SHA-256 `a120d94b62431789671c20307a4f34e642c5ca935ca7a51f02d2dd08396280b7`.
La aplicación estaba importando esa copia íntegra. El archivo tiene canal alpha,
pero también residuos cuadriculados semitransparentes en las separaciones del
libro. Tener píxeles transparentes en el exterior no acreditaba la limpieza del
interior. La revisión sobre fondo oscuro confirma el defecto del recurso fuente.

No se encontró un SVG/vector oficial entre el repositorio y los recursos locales
revisados. Se conserva el PNG original y se añade `siare-logo-clean.png`, una
copia restaurada mediante la herramienta integrada `image_gen` y la habilidad
`imagegen`, tomando el original como referencia. Es una restauración raster,
no una nueva fuente vectorial oficial. Se revisaron formas, letras y paleta
contra el original y se corrigió la saturación de una primera variante.

El PNG restaurado mide 1536 × 1024 y conserva alpha. Su SHA-256 es
`4d5ed6869d5bfa05ea7cfaf0c411b280159091e0fda52a4d146555ddc00f3bf7`.
No se aplanó sobre un fondo. Se sirve directamente con `Image unoptimized`:
el navegador recibe exactamente esos bytes PNG, sin conversión a WebP.
También se retira la sombra CSS de la silueta para evitar el contorno claro.

## Tamaño y composición

El dibujo ocupa el 90% de su caja anterior: 576 → 518,39 px en escritorio
de 1440 px, 640 → 576 px a 1920 px, 380 → 342 px en tableta y 280 → 252 px
en móvil. Se mantiene la caja con `aspect-ratio: 1` y se centra el dibujo dentro.
Así, bienvenida, panel, cards y footer conservan posición y dimensiones.

## Evidencias y pruebas

- [Original frente a restauración, fondos claro y oscuro](evidencias/h6-logo-clean/asset-review.png).
- [Antes/después oscuro](evidencias/h6-logo-clean/comparacion-dark.jpg).
- [Antes/después claro](evidencias/h6-logo-clean/comparacion-light.jpg).
- [Diagnóstico del alpha](evidencias/h6-logo-clean/source-diagnosis.json).
- [PNG servido y geometría](evidencias/h6-logo-clean/logo-verification.json).
- [Resumen](evidencias/h6-logo-clean/validation-summary.json).

Se verifican ocho combinaciones de tamaño/tema: archivo servido idéntico al
recurso limpio, sin `srcset` de conversiones, sin filtro CSS; muestras de huecos
con alpha ≤2/255 y muestras interiores del símbolo con alpha ≥250/255. La
comparación de geometría con el despliegue anterior registra **0 px de cambio**
en los otros bloques, y una escala del logo de 0,9 (con redondeo de subpíxel).

El Dockerfile ejecuta 45 pruebas unitarias, compilación Next y TypeScript.
Playwright ejecuta 11 casos y omite una repetición móvil: la matriz ya contempla
1920, 1728, 1440, 1024, 768, 390 y 320 px en ambos temas y pestañas. Se revisan
capturas reales del despliegue; no hay saltos entre login y registro.

## Despliegue selectivo

Proyecto `siare-h6-3-validation`, servicio `frontend-h6`. Se conservan los
manifests activos y se añade `.cache/h6-logo-clean/preview.override.json`,
cambiando solo imagen y etiquetas. Se ejecutan los controles oficiales de
propiedad, Docker, configuración y volúmenes; después, Compose con
`--no-deps --no-build --pull never --wait --wait-timeout 120`.

Imagen: `siare-academico-frontend:h6-logo-clean`,
`sha256:f01c61b31d3f0ad558f2b05fd4b2d56c0431a72d22fd82a4aa85ce524287e8ee`.
Contenedor: `9e62f9a88131`, `siare-h6-3-validation-frontend-h6-1`, **healthy**.
Reversión conservada: `siare-academico-frontend:h6-logo-clean-rollback`,
`sha256:ca59092ea6e363652702f4eb352d11c1b4bc8d21cbf3b4130ecc35ad64c4413b`.

3100 mantiene su contenedor `eae9ae80e3c1`, imagen, configuración y fecha de
inicio; su DOM y captura son idénticos. Los nueve servicios habituales siguen
healthy. Ambos `/api/health` responden HTTP 200 / UP. `.env`, `main`, fotografía,
PNG original, credenciales, redes, mounts y volúmenes siguen preservados. No se
fusiona ni publica la rama. Véanse [despliegue](evidencias/h6-logo-clean/deployment-verification.json)
y [verificación de 3100](evidencias/h6-logo-clean/habitual-browser.json).
