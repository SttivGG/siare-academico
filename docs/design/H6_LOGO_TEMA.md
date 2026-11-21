# Letras del logo según el tema

Preview: <http://127.0.0.1:3107/>. Rama `feat/h6-landing-access`.
Código desplegado: `538f0c5`.

Las letras SIARE se muestran blancas en oscuro y conservan el negro original en
claro. Se reutiliza el mismo PNG limpio en una capa decorativa, recortada a la
zona inferior de las letras, con filtro blanco solo en oscuro. El libro, el
birrete, el tamaño, las transparencias y la composición permanecen iguales.
La capa no añade un nombre accesible duplicado ni una descarga de otro recurso.

El CSS respeta `data-theme` y la preferencia del sistema cuando no hay elección
explícita. No se modifica el control existente ni la gestión de preferencias.

Validación en Chromium, escritorio y móvil: ocho estados cubren inicio en oscuro
por el sistema, claro explícito, vuelta a oscuro y recarga. El píxel interior de
la letra I es RGB 254/254/254 en oscuro y 42/42/41 en claro. La comparación del
símbolo con la capa desactivada difiere como máximo un nivel RGB por composición
del navegador; no cambia su color ni la geometría. También se verifica que una
elección explícita oscura prevalece cuando el sistema pasa a claro.

- [Oscuro](evidencias/h6-logo-theme/3107-desktop-dark-toggle.png).
- [Claro](evidencias/h6-logo-theme/3107-desktop-light-toggle.png).
- [Mediciones de color](evidencias/h6-logo-theme/wordmark-verification.json).

Pasan 45 pruebas unitarias, Next build y TypeScript; Playwright registra 11 casos
correctos y una repetición móvil omitida porque su matriz ya incluye móvil.
Se conservan las 28 combinaciones de tamaño, tema y pestaña sin saltos.

Despliegue selectivo del servicio `frontend-h6`, proyecto
`siare-h6-3-validation`, con los controles oficiales y Compose
`--no-deps --no-build --pull never --wait --wait-timeout 120`.

- Imagen `siare-academico-frontend:h6-logo-theme`,
  `sha256:3eb0e6c3f17e289eb92758b0499dbca27ad3d2c3a7c15d03fe3ddc75812aa3d2`.
- Contenedor `a9639cddbfe6`, **healthy**.
- Reversión `siare-academico-frontend:h6-logo-theme-rollback`,
  `sha256:f01c61b31d3f0ad558f2b05fd4b2d56c0431a72d22fd82a4aa85ce524287e8ee`.

3100 conserva su contenedor, imagen, DOM y captura; ambos endpoints de salud
responden UP. Los nueve servicios habituales, configuración, redes, mounts,
volúmenes, `.env`, claves, PNG original y fotografía siguen preservados. No se
fusiona ni publica la rama. [Registro del despliegue](evidencias/h6-logo-theme/deployment-verification.json).
