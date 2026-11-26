"""Plantillas deterministas de prompts para generación educativa mediante Gemini.

Los prompts no permiten comandos ejecutables, HTML ni Markdown. El servicio valida
que la respuesta Gemini sea JSON y corresponda al esquema aceptado.
"""


CLASSIFY_TOPICS_PROMPT = """Clasifica el siguiente contenido académico.
Devuelve exclusivamente JSON válido con este esquema exacto:
{"subject":"","topics":[]}

Reglas:
- Usa nombres cortos y reales de materia y temas.
- No inventes taxonomías ni identificadores UUID.
- topics debe contener entre 1 y 20 nombres únicos.
- No uses Markdown, HTML, comandos ni explicación adicional.
- Si no puedes clasificar con seguridad, usa subject="UNDETERMINED" y topics=[].

Contenido:
"""


ASSESSMENT_PROMPT = """Genera una evaluación para el tema solicitado usando el contenido proporcionado como fuente principal.
Devuelve exclusivamente JSON válido con este esquema exacto:
{"questions":[{"question":"","options":[""],"correctAnswer":0,"difficulty":"BASIC","topicId":""}]}

Reglas:
- Usa primero fragmentos, ejemplos, operadores y resultados presentes en el contenido.
- Si el tema solicitado contiene ambigüedad, aclara brevemente la relación entre el concepto y el documento antes de plantear la pregunta.
- Solo puedes complementar conceptos generales estrictamente relacionados con el tema del documento.
- Cuando completes una idea, no atribuyas ese dato a una fuente externa ni inventes citas.
- Si una pregunta depende de información que no aparece en el documento y no puede aclararse sin inventar, omítela.
- Genera como máximo la cantidad solicitada.
- Incluye entre 2 y 6 opciones por pregunta.
- correctAnswer es el índice de cero de la opción correcta.
- difficulty debe ser BASIC, INTERMEDIATE o ADVANCED.
- topicId debe ser estable, corto y derivado del tema real; no inventes UUID.
- No uses HTML, Markdown, enlaces, scripts ni texto fuera del JSON.
- Las preguntas deben evaluarse directamente con el contenido.
- No incluyas respuestas en el texto de las opciones adicionales.

Tema principal solicitado:
"""


FEEDBACK_PROMPT = """Genera retroalimentación educativa respetuosa basada en el rendimiento proporcionado.
Devuelve exclusivamente JSON válido con este esquema exacto:
{"message":"","items":[{"topicId":"","message":""}],"recommendations":[{"topicId":"","priority":1,"action":"REVIEW_TOPIC","reasonCode":"LOW_MASTERY"}]}

Reglas:
- No diagnostiques ni afirmes capacidad intelectual permanente.
- No digas que el estudiante reprobó o irá a reprobar.
- No uses HTML, Markdown, scripts ni texto fuera del JSON.
- Describe acciones educativas concretas y revisables.
- priority comienza en 1 y no debe repetirse dentro de recommendations.
- action debe ser REVIEW_TOPIC, PRACTICE_TOPIC o MAINTAIN.
- reasonCode debe ser estable y corto.

Datos de rendimiento:
"""
