# SIARE en #FFAE62 para tema oscuro

Preview: <http://127.0.0.1:3107/>. Rama `feat/h6-landing-access`.
Código desplegado: `2fb3301`.

Solo las letras del logo pasan de blanco a `#FFAE62` cuando el tema es oscuro;
en claro conservan el negro original. Se utiliza el alpha del PNG limpio como
máscara CSS, con el mismo recorte inferior y dimensiones de la capa anterior.
Esto permite declarar el color exacto sin filtros aproximados, modificar el PNG
ni teñir el birrete o el libro. La capa sigue siendo decorativa y no intercepta
interacciones. Se respeta la preferencia explícita y la del sistema.

La verificación de navegador cubre escritorio y móvil, tema del sistema,
alternancia a claro y oscuro, recarga y prevalencia de la elección explícita
frente al sistema. Se comprueba el color CSS RGB 255/174/98 y el píxel interior
de una letra, con tolerancia de dos niveles por el alpha del PNG. Las letras en
claro siguen negras. El símbolo y las dimensiones conservan el aspecto anterior.

- [Oscuro](evidencias/h6-logo-amber/3107-desktop-dark-toggle.png).
- [Claro](evidencias/h6-logo-amber/3107-desktop-light-toggle.png).
- [Mediciones de píxeles](evidencias/h6-logo-amber/wordmark-verification.json).
- [Pruebas y compilación](evidencias/h6-logo-amber/build.txt).

El Dockerfile ejecuta las 45 pruebas existentes, Next build y TypeScript. Se
despliega únicamente `frontend-h6`, proyecto `siare-h6-3-validation`, con los
controles oficiales y Compose `--no-deps --no-build --pull never --wait`.
Imagen `siare-academico-frontend:h6-logo-amber`; reversión conservada en
`siare-academico-frontend:h6-logo-amber-rollback`. Los IDs completos de imágenes,
contenedores y salud están en el [registro de despliegue](evidencias/h6-logo-amber/deployment-verification.json).

3100 mantiene contenedor, imagen, configuración, DOM y captura. Ambos endpoints
de salud responden UP y los nueve servicios habituales permanecen healthy.
Se preservan datos, redes, mounts, volúmenes, `.env`, claves, `main`, PNG y
fotografía. No se fusiona ni publica la rama.
