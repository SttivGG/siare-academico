"""One disposable process per extraction; stdout is exclusively the JSON result."""
import json
import os
import sys


def main():
    # Cargar las bibliotecas Python antes del límite de memoria evita que el
    # sandbox asesine el worker durante el import inicial. Ningún documento se
    # lee ni se procesa hasta que termine restrict(); así se preserva el aislamiento.
    try:
        from app.models.extraction import extract, ExtractionError
    except Exception:
        with open(sys.argv[3], "w", encoding="utf-8") as output:
            json.dump({"errorCode": "UNSAFE_DOCUMENT"}, output)
        return

    try:
        from app.models.parser_sandbox import restrict
        restrict(sys.argv[1], os.path.dirname(sys.argv[3]))
    except Exception:
        with open(sys.argv[3], "w", encoding="utf-8") as output:
            json.dump({"errorCode": "SANDBOX_UNAVAILABLE"}, output)
        return

    try:
        payload = {"result": extract(sys.argv[1], sys.argv[2])}
    except ExtractionError as error:
        payload = {"errorCode": error.code}
    with open(sys.argv[3], "w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False)


if __name__ == "__main__":
    main()
