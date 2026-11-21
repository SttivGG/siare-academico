# Evidencia H6-3

Origen: http://127.0.0.1:3107. Implementación: `4442b69064a116b820051a5470ec188383e585aa`. Contenido académico y cuentas sintéticos. Las evaluaciones y estados documentales proceden de Spring y del procesador reales.

La matriz contiene ocho estados, ambos temas y cinco tamaños: 1440×900, 1920×1080, 768×1024, 390×844 y 320×844. Se ejecuta en Chromium con contexto de escritorio y móvil, con 160 PNG. Los JSON de cada carpeta registran navegador, geometría y errores. Los archivos `fuente-failed.png` añaden el estado documental fallido.

| Estado | Claro 1440 | Oscuro 1440 | Claro 390 | Oscuro 390 |
| --- | --- | --- | --- | --- |
| Workspace vacío | [PNG](desktop/vacio-light-1440x900.png) | [PNG](desktop/vacio-dark-1440x900.png) | [PNG](mobile/vacio-light-390x844.png) | [PNG](mobile/vacio-dark-390x844.png) |
| Documento seleccionado | [PNG](desktop/documento-seleccionado-light-1440x900.png) | [PNG](desktop/documento-seleccionado-dark-1440x900.png) | [PNG](mobile/documento-seleccionado-light-390x844.png) | [PNG](mobile/documento-seleccionado-dark-390x844.png) |
| Lectura académica | [PNG](desktop/lectura-light-1440x900.png) | [PNG](desktop/lectura-dark-1440x900.png) | [PNG](mobile/lectura-light-390x844.png) | [PNG](mobile/lectura-dark-390x844.png) |
| Quiz en curso | [PNG](desktop/quiz-light-1440x900.png) | [PNG](desktop/quiz-dark-1440x900.png) | [PNG](mobile/quiz-light-390x844.png) | [PNG](mobile/quiz-dark-390x844.png) |
| Crucigrama en curso | [PNG](desktop/crucigrama-light-1440x900.png) | [PNG](desktop/crucigrama-dark-1440x900.png) | [PNG](mobile/crucigrama-light-390x844.png) | [PNG](mobile/crucigrama-dark-390x844.png) |
| Banco en revisión | [PNG](desktop/banco-revision-light-1440x900.png) | [PNG](desktop/banco-revision-dark-1440x900.png) | [PNG](mobile/banco-revision-light-390x844.png) | [PNG](mobile/banco-revision-dark-390x844.png) |
| Evaluación de Spring | [PNG](desktop/evaluacion-light-1440x900.png) | [PNG](desktop/evaluacion-dark-1440x900.png) | [PNG](mobile/evaluacion-light-390x844.png) | [PNG](mobile/evaluacion-dark-390x844.png) |
| Recuperación local opcional | [PNG](desktop/recuperacion-light-1440x900.png) | [PNG](desktop/recuperacion-dark-1440x900.png) | [PNG](mobile/recuperacion-light-390x844.png) | [PNG](mobile/recuperacion-dark-390x844.png) |

Las otras resoluciones siguen el mismo nombre en `desktop/` y `mobile/`. [Mediciones de escritorio](desktop/validacion.json) y [mediciones del contexto móvil](mobile/validacion.json).

[Pruebas finales](pruebas.json), [runtime y preservación](runtime.json), [humo del navegador habitual](habitual-browser.json) y [captura del login habitual en 3100](habitual-3100.png). La captura de 3100 pertenece a la instalación anterior conservada, no a H6-3.

Se comprobó geometría, teclado/foco, cambio de tema y escalado de fuente al 200 %. El teclado virtual físico, lector de pantalla, Firefox/WebKit y zoom real no se acreditan con estas capturas. Los detalles y omisiones están en [H6_3_INFORME.md](../../H6_3_INFORME.md).
