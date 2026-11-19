FROM node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
RUN apt-get update && apt-get install -y --no-install-recommends chromium=156.0.8078.79-1~deb12u1 && rm -rf /var/lib/apt/lists/*
USER node
