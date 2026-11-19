# H4: actividades en la web

Desde una materia, la web presenta documentos, aprendizaje y actividades en tres
paneles. Adopta los tokens comprobados en `Facturacion-hexagonal` (Nexo): Urbanist
local, naranja #f58136 con texto oscuro, vidrio y tarjetas menta/rosa/azul. La
estructura se apila en móvil y respeta movimiento reducido. La fuente procede
del repositorio de referencia indicado por el usuario; su licencia OFL se incluye
con el archivo local. No se realizan peticiones a Google Fonts.

El panel documental conserva las rutas, carga multipart, descarga, procesamiento,
errores y renovación de sesión existentes de `main`. Ordena por fecha descendente
y solo permite usar documentos READY como fuente. Las correcciones documentales
que existían sin confirmar en otra rama quedan fuera de H4.

## Recorrido

1. Entrar a una materia, subir/procesar un documento o seleccionar uno READY.
2. Abrir **Preparar banco**, consultar sus fragmentos e importar un JSON
   `ActivityBank` o añadir entradas vacías y editarlas en el editor JSON.
3. Indicar tipo, tema exacto, cantidad y cuadrícula (obligatoria también en Quiz).
   Cada pregunta requiere opciones, clave y explicación; cada palabra requiere
   respuesta y pista. Con documento, todas las entradas requieren reference,
   fragmentIndex y quote verificables. Ver [H3](H3_ACTIVIDADES.md) y OpenAPI.
4. Pulsar **Validar y revisar banco**. Leer el contenido y confirmar explícitamente
   la revisión humana. Importar `validated:true` nunca sustituye esta confirmación.
5. Crear la actividad. Spring genera su presentación pública; el editor se cierra
   y el jugador usa exclusivamente esa respuesta, sin consultar claves del banco.
6. Resolver Quiz con opciones y navegación, o Crucigrama con pistas numeradas,
   celdas compartidas, flechas, retroceso y dirección horizontal/vertical.
7. Enviar. Spring calcula y guarda la evaluación. Solo entonces se muestran
   soluciones, explicaciones y porcentaje devueltos por el servidor.
8. Copiar el ID de intento o usar el enlace del panel central. **Intentos** consulta
   la evaluación autorizada con activityId/attemptId; el enlace conserva ambos IDs.

H3 no ofrece una operación para enumerar todos los intentos. La pequeña lista de
consultados vive en memoria de la pantalla y no se presenta como historial completo.
El enlace prepara la consulta, que requiere pulsar **Consultar evaluación** y una
sesión propia. No se guardan porcentajes, tokens o bancos en localStorage.

La actividad reciente es la última abierta/creada en esta pantalla. La evaluación
central es la última obtenida/consultada aquí. Sin datos hay estados vacíos, sin
promedios ficticios. Analítica, recomendaciones, generación desde prosa, exámenes,
simulacros, tarjetas y otros juegos están identificados como pendientes.

## BFF y seguridad

Solo se añaden las cinco operaciones H3 actuales. Se valida UUID, métodos y cursor;
no se habilitan respuestas correctas, borrado de actividades ni listas inexistentes.
El catálogo envía limit 20 y conserva nextCursor; **Cargar más** anexa sin duplicados.

Límites por bytes efectivamente recibidos, incluso sin Content-Length:

| Operación | Límite |
| --- | --- |
| Crear banco/actividad | 4 MiB |
| Enviar intento | 64 KiB |
| Resto del BFF JSON | 16 KiB (se conserva) |

Los límites no sustituyen la validación estricta de Spring. Un banco excepcionalmente
grande por escape JSON puede exceder el límite de transporte aunque sus entradas
aisladas cumplan el esquema; debe dividirse. La importación limita archivo y cuerpo
serializado. Los cuerpos no se registran en logs. Cookies HttpOnly y política CSRF
de origen exacto, JSON y cabecera propia se mantienen; sessionFetch renueva la sesión.

En el primer envío se congela `{idempotencyKey,answers,durationMs}`. Un fallo de red,
timeout o pérdida de respuesta mantiene el cuerpo y bloquea edición/cambio de
actividad para repetir exactamente el mismo intento. Solo una evaluación confirmada
habilita **Nuevo intento** con nueva clave. Al recargar o cerrar la pestaña se solicita el aviso del
navegador; el sobre vive en memoria y se pierde al abandonar la pantalla, incluida
la navegación interna. No se
reintenta automáticamente un POST de creación que carece de idempotencia H3.

Las materias archivadas conservan consultas y resultados; no crean actividades ni
intentos nuevos. Un reenvío ya congelado puede recuperar su confirmación.

## Dependencia de ML

No hay conversión automática de texto extraído a preguntas. La propuesta de
[contrato de borradores](H4_CONTRATO_GENERACION_ML.md) requiere revisión y acuerdo
con el responsable de ML antes de implementar su endpoint. Python, Express,
móvil, persistencia y servicios de infraestructura permanecen fuera de este PR.
