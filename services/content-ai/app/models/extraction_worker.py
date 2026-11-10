"""One disposable process per extraction; stdout is exclusively the JSON result."""
import json
import sys


def main():
    if sys.platform != "win32":
        import resource
        # Address space is distinct from RSS. The container keeps its 256 MiB limit.
        resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
        resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024 * 1024,) * 2)
    from app.models.extraction import extract, ExtractionError
    try:
        payload = {"result": extract(sys.argv[1], sys.argv[2])}
    except ExtractionError as error:
        payload = {"errorCode": error.code}
    with open(sys.argv[3], "w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False)


if __name__ == "__main__":
    main()
