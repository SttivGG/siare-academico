"""Generador local determinista para mantener evaluaciones disponibles si Gemini falla.

El fallback no sustituye el modelo real ni afirma ML avanzado. Construye una
pregunta estructurada por concepto detectable en el texto y conserva una clave única.
"""

import re
import uuid


QUESTION_PATTERNS = (
    (r"\$match|match", "¿Qué operador de MongoDB se usa para filtrar documentos?", "El operador match filtra documentos antes de las siguientes etapas.", "$match", ("$match", "$group", "$sort", "$limit")),
    (r"\$project|project", "¿Qué operador selecciona o oculta campos de cada documento?", "El operador project controla los campos visibles.", "$project", ("$project", "$match", "$sum", "$limit")),
    (r"\$group|group", "¿Qué operador agrupa documentos que comparten un criterio?", "El operador group reúne documentos y permite calcular valores.", "$group", ("$group", "$match", "$sort", "$limit")),
    (r"\$sort|sort", "¿Qué operador cambia el orden de los documentos?", "El operador sort ordena los resultados según el campo indicado.", "$sort", ("$sort", "$limit", "$match", "$project")),
    (r"\$limit|limit", "¿Qué operador conserva solo una cantidad determinada de resultados?", "El operador limit conserva el número inicial de resultados indicado.", "$limit", ("$limit", "$sort", "$group", "$match")),
    (r"\$avg|avg|promedio", "¿Qué operador calcula el promedio de una expresión numérica?", "El operador avg calcula la media dentro de un grupo.", "$avg", ("$avg", "$sum", "$min", "$max")),
    (r"\$sum|sum|conteo", "¿Qué operador acumula valores o cuenta documentos con sum: 1?", "El operador sum acumula valores y sum: 1 cuenta documentos.", "$sum", ("$sum", "$avg", "$min", "$limit")),
    (r"\$min|min", "¿Qué operador devuelve el menor valor de un campo?", "El operador min obtiene el menor valor dentro del grupo.", "$min", ("$min", "$avg", "$sum", "$max")),
)


def topic_id(topic: str) -> str:
    """Genera un identificador estable legible sin consultar taxonomías externas."""
    normalized = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")
    return normalized[:100] or "topic-general"


def build_fallback_assessment(topic: str, content: str, count: int) -> dict:
    """Construye una evaluación local válida y determinista a partir del PDF y tema."""
    if not isinstance(topic, str) or not topic.strip():
        raise ValueError("El tema no puede estar vacío")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("El contenido no puede estar vacío")
    if not isinstance(count, int) or count < 1 or count > 50:
        raise ValueError("Cantidad fuera de rango")

    text = content + "\n" + topic
    selected = []
    for pattern, question, explanation, answer, options in QUESTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            selected.append((question, explanation, answer, options))

    if not selected:
        selected = [(
            f"¿Cuál es el tema principal tratado en el documento: {topic}?",
            "La respuesta se basa en el tema solicitado y en el contenido extraído.",
            topic,
            (topic, "Otro tema", "Información no relacionada", "Ningún tema"),
        )]

    questions = []
    for index in range(count):
        question, explanation, answer, options = selected[index % len(selected)]
        questions.append({
            "question": question,
            "options": list(options),
            "correctAnswer": options.index(answer),
            "difficulty": "BASIC" if index % 3 == 0 else "INTERMEDIATE",
            "topicId": topic_id(topic),
        })

    return {
        "assessmentId": str(uuid.uuid4()),
        "model": "fallback-document-v1",
        "questions": questions,
    }
