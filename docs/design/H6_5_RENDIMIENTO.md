# H6-5: medición frente a H6-4

Comparé la imagen H6-4 que estaba activa en 3107 (`cc6cd704`, imagen `515ff308`) con el runtime H6-5 final (`06000f6e`, imagen `2f2dc7f3`). [rendimiento.json](evidencias/h6-5/rendimiento.json) conserva las muestras individuales, tamaños y métricas CDP.

## Condiciones y reproducción

Chrome/Chromium headless `157.0.8103.79`, Node local `v24.14.0`, Dockerfile con Node `24.22.2`, Next `16.4.6`; Windows/Docker Desktop, un CPU y 384 MiB para la preview. Viewport 1440×900, movimiento no-preference, sin throttling de CPU/red. Se usa la misma cuenta USER sintética y la misma materia/actividades en ambas fases.

Cada ruta recibe seis navegaciones completas secuenciales. La primera se excluye de la mediana de cinco muestras calientes. La etiqueta original `cold-context` identifica esa primera muestra por ruta; el contexto se reutiliza entre rutas y no garantiza una caché totalmente vacía. Se observa 500 ms tras cargar fuente/título. El CLS suma entradas sin interacción reciente durante esa ventana; no es una métrica de campo. Las peticiones de chunks pueden incluir prefetch, por lo que los bytes de ruta y el tamaño total de imagen se informan por separado.

Se terminó la comparación antes de iniciar la suite completa. Los valores finales reemplazan una serie exploratoria de la primera imagen H6-5. La captura final espera 240 ms tras cambiar tema para registrar el estado asentado de las transiciones de hasta 220 ms. La espera no entra en los tiempos Navigation Timing.

```powershell
# Con H6-4 activa en la preview aislada:
node tests/measure-h6.mjs before
node tests/measure-h6-idle.mjs before
# Tras desplegar H6-5 en esa misma preview:
node tests/measure-h6.mjs after
node tests/measure-h6-idle.mjs after
```

Los scripts se ejecutan desde `frontend/`, crean recursos sintéticos propios y guardan la sesión privada en `.cache/h6-5/private-session.json`, ignorada por Git. El modo after requiere esa sesión. La medición no permite reutilizar ni publicar credenciales de otra persona. Para repetir el tamaño total, recorrer `.next/static` en el contenedor activo, sumar bytes de `.js`/`.css` y el tamaño de cada archivo comprimido con `node:zlib.gzipSync`.

## Bundle total de la imagen activa

| Recurso | H6-4 bytes | H6-5 bytes | Delta | H6-4 gzip | H6-5 gzip | Delta gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| JavaScript, 25 archivos | 803001 | 805438 | +2437 | 260014 | 260647 | +633 |
| CSS, 2 archivos | 46325 | 50165 | +3840 | 10661 | 11429 | +768 |
| Total | 849326 | 855603 | +6277 | 270675 | 272076 | +1401 |

La suma gzip aumenta aproximadamente 0,52 %. No se añade ninguna dependencia, chunk, fuente o imagen decorativa al runtime. El crecimiento procede de la presentación y las relaciones de interacción añadidas.

## Navegación y layout

| Ruta | DCL H6-4 ms | DCL H6-5 ms | Load H6-4 ms | Load H6-5 ms | CLS H6-4 / H6-5 |
| --- | ---: | ---: | ---: | ---: | --- |
| Login | 73,3 | 66,0 | 87,1 | 74,8 | 0,0002 / 0,0002 |
| Inicio | 115,0 | 128,7 | 120,5 | 144,6 | 0,0009 / 0,0009 |
| Cuaderno | 102,9 | 115,7 | 115,1 | 122,8 | 0,0048 / 0,0048 |

Los tiempos de Inicio y cuaderno aumentan en esta muestra; login baja. La muestra no permite atribuir esas diferencias al cambio CSS/JS o a la carga del host. No se concluye una mejora de rendimiento. El CLS observado conserva los valores de la base; la prueba funcional aparte comprueba ausencia de desbordamiento en ocho tamaños.

| JavaScript por ruta, mediana | H6-4 decodificado | H6-5 decodificado | H6-4 codificado | H6-5 codificado |
| --- | ---: | ---: | ---: | ---: |
| Login | 504062 | 504062 | 153246 | 153246 |
| Inicio | 524430 | 525042 | 159891 | 160056 |
| Cuaderno | 570477 | 572914 | 174407 | 175040 |

## Reposo y límites

Tras 750 ms de asentamiento, observé dos segundos de reposo en Inicio y en el cuaderno con un crucigrama abierto. Ambas versiones registraron cero mutaciones en `main`, cero layouts, cero recálculos de estilo y cero animaciones en ejecución. El tiempo acumulado de tareas fue 6,53/3,67 ms en Inicio y 50,58/49,86 ms en el cuaderno (H6-4/H6-5). Las pequeñas diferencias no son un benchmark de CPU.

El código no añade bucles de animación, timers decorativos ni actualizaciones de estado por frame. El foco de celda añade estado de presentación cuando cambia la celda; las respuestas siguen en el controlador. El observador DOM y las métricas CDP detectan actividad en reposo, pero no cuentan commits de React. Un perfil React, pruebas largas y mediciones en dispositivos modestos siguen pendientes de H6-6. Tampoco se acredita aquí LCP/INP o Core Web Vitals de campo.
