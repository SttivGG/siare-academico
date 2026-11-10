FROM python:3.12.16-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df AS build
WORKDIR /build
COPY requirements.lock ./requirements.lock
RUN pip install --no-cache-dir --prefix=/install -r requirements.lock

FROM python:3.12.16-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN groupadd --gid 10001 siare && useradd --uid 10001 --gid siare --no-create-home siare
COPY --from=build /install /usr/local
COPY --chown=10001:10001 app ./app
COPY --chown=10001:10001 wsgi.py ./
USER 10001:10001
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "2", "--timeout", "30", "--access-logfile", "-", "wsgi:app"]
