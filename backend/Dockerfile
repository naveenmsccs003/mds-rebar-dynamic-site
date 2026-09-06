# Local-development image. A separate, hardened multi-stage Dockerfile
# (non-root user, pinned base digest, no dev dependencies) is introduced
# in Phase 15 (docker-compose.md / CI_CD.md) for staging/production.
# Pinned to 3.12 (a Django 5.1-supported runtime) rather than whatever
# Python this sandbox's local .venv happened to use — see README.md for why.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/dev.txt

COPY . .

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
