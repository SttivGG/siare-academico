# SIARE Académico | Datos reales y selección de modelos

**Estado:** guía aprobada para planeación y preparación técnica
**Fecha:** 24 de noviembre de 2026
**Modelo activo actual:** `baseline-error-rate-v1`
**Modelo supervisado:** experimental hasta contar con aprobación y datos reales

## 1. Principio de separación

Existen tres tipos diferentes de información:

1. **Datos de estudiantes de SIARE:** observaciones privadas utilizadas para aprender el progreso individual.
2. **Contenido académico público o autorizado:** textos utilizados para generar material de estudio.
3. **Datos públicos externos:** referencias, vocabulario, ejercicios o corpus utilizados como apoyo, sin identificar estudiantes.

No deben mezclarse estudiantes, documentos privados y fuentes públicas dentro del mismo flujo de entrenamiento sin una autorización, licencia y política de privacidad documentadas.

## 2. Qué datos reales necesita el modelo

### Obligatorios

Los datos deben ser observaciones ya evaluadas por Spring, no respuestas libres enviadas por el navegador.

| Campo | Fuente | Uso |
|---|---|---|
| `studentTrainingId` | Pseudónimo generado por Spring | Agrupa observaciones sin exponer identidad |
| `subjectId` | Materia canónica | Segmenta por materia |
| `topicId` | Catálogo aprobado | Define el concepto a aprender |
| `activityId` | Actividad evaluada | Identifica origen |
| `attemptId` | Intento único | Evita duplicados |
| `occurredAt` | Evaluación en Spring | División temporal |
| `score` | Resultado normalizado 0–1 | Característica y posible etiqueta |
| `durationMs` | Tiempo registrado | Característica temporal |
| `correctAnswers` | Resultado detallado | Señal de dominio |
| `totalAnswers` | Resultado detallado | Normaliza acierto |
| `attemptNumber` | Historial derivado | Experiencia previa |

### Derivados válidos

Solo pueden derivarse de observaciones anteriores al instante de decisión:

- Porcentaje acumulado de acierto.
- Tasa reciente de aciertos o errores.
- Tendencia temporal.
- Número de intentos previos.
- Tiempo desde el último intento.
- Errores consecutivos.
- Duración normalizada.
- Tiempo de resolución relativo a la actividad.

### No autorizados por defecto

- Nombre del estudiante.
- Correo.
- Documento de identidad.
- Direcciones.
- Contraseñas o tokens.
- Texto completo de documentos privados.
- Respuestas libres que revelen datos personales.
- Información biométrica.
- Datos sensibles no necesarios para el aprendizaje.

## 3. Unidad de predicción recomendada

La primera unidad entrenable debe ser:

```text
Estudiante pseudonimizado + Materia + Tema + Instante de decisión
```

La etiqueta inicial puede ser:

```text
¿El siguiente intento en ese tema tendrá éxito?
```

Debe definirse la regla de éxito antes de entrenar. La propuesta inicial es:

```text
Éxito si score normalizado >= 0.70
```

Este valor no queda aprobado hasta evaluación real. El modelo no debe inferir diagnóstico médico, psicológico o capacidad intelectual.

## 4. Mínimos de preparación

No se recomienda entrenar el MVP supervisado con menos de:

- 1000 intentos pseudonimizados únicos.
- Variación temporal de varias semanas o ciclos académicos.
- Ambas clases presentes en entrenamiento y evaluación.
- Múltiples estudiantes por tema.
- Múltiples materias si se desea segmentación.
- Muestras suficientes para comparar baseline y modelo.

Estos números son un punto de partida técnico. El tamaño real debe calcularse con los temas, desbalance y cantidad de estudiantes disponibles.

El sistema actual puede abstenerse con menos de cinco intentos por tema. Cinco intentos también son un mínimo sintético, no una garantía de validez estadística.

## 5. Pseudonimización

Spring debe producir un identificador reversible solo dentro de su infraestructura protegida.

Ejemplo conceptual:

```text
studentTrainingId = HMAC-SHA256(studentIdInterno, claveDeDataset)
```

Flask no conoce:

- El secreto HMAC.
- La tabla de correspondencia.
- El nombre del estudiante.
- El UUID original.

Para exportación, Spring debe entregar solo el identificador derivado y las observaciones académicas.

Nunca se deben exportar:

- Bases completas.
- Dumps de MySQL.
- Claves.
- Archivos completos de usuarios.
- El texto completo de documentos privados.
- Datos personales en CSV sin control.

## 6. Requisitos del archivo real

La exportación inicial puede ser un CSV o Parquet con esquema fijo y firmado.

```text
student_training_id
subject_id
topic_id
activity_id
attempt_id
occurred_at
score
duration_ms
correct_answers
total_answers
success_label
dataset_schema_version
```

Además del archivo:

- Diccionario de datos.
- Fecha de corte.
- Versión de la taxonomía.
- Reglas de exclusión.
- Conteos por materia y tema.
- Conteos de clases positivas y negativas.
- Lista de identificadores eliminados o excluidos.
- Hash del archivo.
- Persona responsable.

## 7. División temporal obligatoria

La división debe ser por tiempo, no aleatoria.

Ejemplo:

```text
Entrenamiento: enero a septiembre
Validación: septiembre
Prueba: octubre
```

La partición debe evitar:

- Intentos del futuro en entrenamiento.
- Intentos del mismo estudiante entre particiones si el requisito del proyecto lo exige.
- Mezclar preguntas de validación dentro de entrenamiento.
- Usar el resultado que se intenta predecir como característica.

El resultado debe reportar:

- Precision.
- Recall.
- F1.
- AUC.
- Matriz de confusión.
- Accuracy complementaria.
- Tamaño de muestra.
- Desbalance de clases.
- Comparación contra el baseline.
- Intervalos de confianza si se pueden calcular.

## 8. Recomendación de modelos

### Primera opción: regresión logística

Adecuada para comenzar porque:

- Es pequeña y explicable.
- Consume poca memoria.
- Exporta parámetros seguros a JSON.
- Permite comparar coeficientes.
- Funciona con las características actuales.
- Es compatible con el límite de 256 MiB del servicio.

Riesgo: puede no capturar relaciones complejas entre temas y comportamiento.

### Segunda opción: gradient boosting compacto

Puede utilizarse después si existen datos suficientes:

- Histogram-based Gradient Boosting.
- LightGBM o XGBoost.
- CatBoost si las variables categóricas son importantes.

Ventajas:

- Captura relaciones no lineales.
- Puede superar la logística.

Restricciones:

- Artefacto más grande.
- Mayor coste de serialización y carga.
- Más difícil de explicar.
- Requiere recursos medidos fuera de Flask.

No debería ser el primer modelo en producción sin una ventaja demostrada frente al baseline y la logística.

### Para series temporales

Si existe suficiente historial por estudiante y tema:

- Regresión logística con características temporales.
- Gradient boosting temporal.
- Modelos secuenciales compactos posteriormente.
- Evitar LSTM o Transformers sin justificar volumen y memoria.

### Para textos y aprendizaje adaptativo

Se recomienda separar dos problemas:

1. Clasificar riesgo o necesidad de práctica.
2. Recuperar y generar contenido de estudio.

Para estudiar documentos:

- Extracción actual.
- Fragmentación por unidad.
- Embeddings semánticos.
- Base vectorial o búsqueda BM25.
- Recuperación de contexto.
- Generación controlada con un modelo de lenguaje.

El modelo de progreso no necesita leer ni almacenar el texto completo si solo recibe características académicas.

## 9. Datos externos posibles

Las APIs públicas pueden mejorar contenido y temas, no reemplazar datos reales de intentos.

### Contenido académico abierto

- **OpenAlex:** publicaciones y metadatos de conocimiento académico.
- **Crossref:** metadatos bibliográficos y DOI.
- **Open Library:** libros y metadatos, sujeto a disponibilidad y licencias.
- **Europeana:** recursos culturales y educativos según licencia.
- **Wikimedia/Wikipedia API:** resúmenes y conceptos, sujeto a atribución y licencia.
- **arXiv API:** preprints y metadatos, no necesariamente apropiados para secundaria.
- **OpenStax:** contenido abierto, sujeto a sus licencias y método de integración.

Estas fuentes pueden ayudar a:

- Crear taxonomías.
- Construir temas.
- Asociar conceptos.
- Generar preguntas sobre texto autorizado.
- Recuperar explicaciones y referencias.

No deben usarse para afirmar conocimientos personales del estudiante.

### APIs educativas públicas

Antes de integrar una API se debe comprobar:

- Licencia.
- Atribución.
- Uso comercial o académico.
- Conservación de datos.
- Disponibilidad geográfica.
- Límites de velocidad.
- Autenticación.
- Riesgo de datos personales.
- Si permite caché y persistencia.

La disponibilidad de una API no autoriza automáticamente redistribuir su contenido.

### APIs de modelos de lenguaje

Se puede usar una API externa para:

- Generar ejercicios.
- Resumir fragmentos autorizados.
- Explicar respuestas.
- Clasificar contenido con supervisión humana.

No se debe enviar:

- El documento privado sin autorización.
- Identidad del estudiante.
- Historial personal completo.
- Claves o secretos.

Para producción se recomienda:

- Separar proveedor de modelo del backend principal.
- Registrar proveedor, versión y prompt.
- Mantener trazabilidad de contexto.
- Validar contenido generado.
- Limitar el coste.
- Dar al usuario control sobre el envío externo.

## 10. No sustituir datos reales con datos externos

Las APIs públicas no contienen la historia real del estudiante.

Un corpus externo puede servir para:

- Entrenamiento semántico.
- Generación de preguntas.
- Ejemplos sintéticos.
- Taxonomía curricular.

Pero no demuestra el desempeño real de los estudiantes de SIARE.

Los datos externos pueden complementar el producto, pero no deben presentarse como evidencia de aprendizaje ni reemplazar la evaluación temporal real.

## 11. Camino recomendado

1. Mantener el baseline activo.
2. Completar contrato y integración Spring con datos sintéticos.
3. Acordar taxonomía temporal y persistencia de intentos.
4. Generar exportación pseudonimizada real.
5. Validar calidad y tamaño.
6. Entrenar regresión logística offline.
7. Dividir temporalmente.
8. Comparar contra el baseline.
9. Aprobar artefacto JSON.
10. Desplegar por `modelVersion`.
11. Supervisar rendimiento por materia y tema.
12. Considerar modelos más complejos solo si agregan valor demostrado.

## 12. Información que deben proporcionar los responsables

Para iniciar el dataset real se requiere:

- Periodo histórico disponible.
- Fecha de corte.
- Cantidad aproximada de estudiantes.
- Cantidad aproximada de intentos.
- Cantidad aproximada de temas.
- Materias disponibles.
- Reglas de exclusión.
- Responsable de aprobación.
- Política de pseudonimización.
- Retención y eliminación.
- Clave o procedimiento que Spring conservará para reidentificación restringida.
- Criterio final de éxito.
- Umbral mínimo de aceptación.

No es necesario enviar nombres o documentos personales para decidir si existe un volumen suficiente. El equipo puede compartir primero conteos agregados y un esquema firmado.
