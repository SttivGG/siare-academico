# Evidencias visuales H6-1

Estas capturas corresponden a prototipos locales en `docs/design/h6-1/`, no al frontend desplegado. No se cambiaron código productivo, API, migraciones, Docker ni módulos de otros compañeros.

## Abrir y comparar

La [galería HTML](../../h6-1/index.html) reúne las imágenes y enlaces a los controles interactivos. El [sistema de diseño](../../H6_1_SISTEMA_DISENO.md), las [alternativas](../../H6_1_ALTERNATIVAS.md) y los [riesgos bloqueantes](../../H6_1_RIESGOS_Y_REGRESIONES.md) explican alcance y decisiones.

| Vista | Claro | Oscuro |
| --- | --- | --- |
| A, escritorio 1440 × 1000 | [Captura](a-light-desktop.png) | [Captura](a-dark-desktop.png) |
| A, tableta 1024 × 900 | [Captura](a-light-tablet.png) | [Captura](a-dark-tablet.png) |
| A, móvil 390 × 844 | [Captura](a-light-mobile.png) | [Captura](a-dark-mobile.png) |
| B, escritorio 1440 × 1000 | [Captura](b-light-desktop.png) | [Captura](b-dark-desktop.png) |
| B, tableta 1024 × 900 | [Captura](b-light-tablet.png) | [Captura](b-dark-tablet.png) |
| B, móvil 390 × 844 | [Captura](b-light-mobile.png) | [Captura](b-dark-mobile.png) |
| Catálogo de componentes, página completa | [Captura](componentes-light.png) | [Captura](componentes-dark.png) |
| Diálogo de archivo, solo demostración | [Captura](dialogo-light.png) | [Captura](dialogo-dark.png) |

También se conservan [fuentes en móvil A](a-light-mobile-fuentes.png), [Estudio en móvil A](a-dark-mobile-estudio.png), [fuentes en tableta B](b-light-tablet-fuentes.png), [banco en móvil B](b-dark-mobile-banco.png), [lectura en A](a-light-lectura.png), [móvil A completo](a-light-mobile-completo.png), [foco de teclado](foco-light.png) y [galería completa](galeria.png).

Las páginas completas permiten inspeccionar contenido fuera del primer viewport. La altura de las imágenes de móvil no equivale al tamaño de una pantalla física; las capturas `*-mobile.png` sí muestran un viewport 390 × 844.

## Comprobaciones registradas

- [validacion.json](validacion.json): versión efectiva de Chromium, fecha UTC, capturas, geometría de los 12 casos principales, ancho del documento, fuente local cargada y errores de ejecución. Incluye anchos adicionales 320, 375, 768, 1366 y 1920.
- [contraste.json](contraste.json): 58 pares de texto y control, con composición de alpha sobre los tres extremos de fondo declarados. El cálculo no sustituye revisar cada navegador y contexto.
- [preservacion.json](preservacion.json): aislamiento del cambio documental, estado de skills y referencias originales, y comprobación de contenedores en modo lectura.
- [manifest.sha256](manifest.sha256): integridad de esta carpeta. El prototipo tiene además su manifiesto en `h6-1/`.

El recorrido del prototipo verifica conservar una respuesta al abrir banco y volver; conservar el tema escrito al volver; y conservarlo después de redimensionar a móvil y alternar paneles. No usa React ni backend: **estos resultados no prueban que SIARE esté corregido**. La matriz de regresiones productivas sigue pendiente.

La captura automatizada también comprueba foco en diálogo, Escape, restauración del foco al activador, control de tema y enlace de salto. El registro no debe contener solicitudes HTTP/HTTPS: solo archivos locales. La puntuación no se simula. Las fuentes y preguntas de muestra no son datos de estudiantes.

## Reproducción

Desde la raíz del checkout habitual, usando las dependencias Playwright ya instaladas:

```powershell
node .worktrees/h6/docs/design/h6-1/capturar.mjs
python -B .worktrees/h6/docs/design/h6-1/verificar.py
```

El capturador usa por defecto el paquete Playwright del checkout habitual y detecta un Chromium local en Windows. Se pueden indicar `H6_PLAYWRIGHT_MODULE` y `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con rutas válidas. No instala paquetes, no levanta un servidor, no lee `.env` ni llama a SIARE. Si faltan esas dependencias, las imágenes entregadas siguen siendo revisables.

El verificador genera `tokens.json` a partir de CSS, calcula contraste, comprueba fuente/licencia, conserva hashes de H6-0 y revisa enlaces. Cualquier modificación de los prototipos requiere recapturar antes de actualizar los manifiestos.

## Límites

Se usó Chromium real y locale es-CO, zona America/Bogota, movimiento reducido y viewport redimensionado. No se certifican Firefox/Safari, lector de pantalla, teléfono físico, teclado virtual, rendimiento Next.js, zoom real al 200 % ni recuperación durable. Los controles H3/H4 que requieren backend quedan representados, sin llamadas ni efectos.

El entorno utiliza UTC en los registros; una marca del 20 de noviembre UTC corresponde todavía al 19 de noviembre en Bogotá durante esta sesión. Las referencias Nexo/NotebookLM originales y su procedencia se conservan en [H6-0](../h6-0/README.md).
