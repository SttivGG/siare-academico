FROM python:3.12.16-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df AS build
WORKDIR /build
COPY requirements.lock ./requirements.lock
RUN pip install --no-cache-dir --prefix=/install -r requirements.lock

FROM python:3.12.16-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN groupadd --gid 10001 siare && useradd --uid 10001 --gid siare --no-create-home siare
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr=5.3.0-2 tesseract-ocr-spa=1:4.1.0-2 && rm -rf /var/lib/apt/lists/*
COPY --from=build /install /usr/local
COPY --chown=10001:10001 app ./app
COPY --chown=10001:10001 wsgi.py ./
COPY --chown=10001:10001 tests ./tests
USER 10001:10001
RUN SIARE_REAL_OCR=1 python -m unittest discover -s tests -v && pip check
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "2", "--timeout", "30", "--no-control-socket", "--access-logfile", "-", "wsgi:app"]
