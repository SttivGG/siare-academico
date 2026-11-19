"""One disposable process per extraction; stdout is exclusively the JSON result."""
import json
import os
import sys


def main():
    try:
        from app.models.parser_sandbox import restrict
        restrict(sys.argv[1], os.path.dirname(sys.argv[3]))
    except Exception:
        with open(sys.argv[3], "w", encoding="utf-8") as output:
            json.dump({"errorCode": "SANDBOX_UNAVAILABLE"}, output)
        return
    from app.models.extraction import extract, ExtractionError
    try:
        payload = {"result": extract(sys.argv[1], sys.argv[2])}
    except ExtractionError as error:
        payload = {"errorCode": error.code}
    with open(sys.argv[3], "w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False)


if __name__ == "__main__":
    main()
