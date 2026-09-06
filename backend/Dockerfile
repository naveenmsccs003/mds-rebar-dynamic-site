# Multi-stage image for the Django backend + the Celery worker/scheduler
# (they run the same code, different commands — docs/DEPLOYMENT.md).
#
#   docker build --target dev  -t mds-backend:dev  ./backend
#   docker build --target prod -t mds-backend:prod ./backend
#
# `dev` has the dev/test deps and runs the autoreloader (used by
# docker-compose). `prod` is slim, runs as a non-root user, ships only
# runtime deps, and serves via gunicorn. CI builds `prod` and promotes
# the same image through staging → production.

# ---------- base: shared runtime ----------
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
# libpq for psycopg (runtime); build-essential only where wheels compile.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

# ---------- builder: compile wheels ----------
FROM base AS builder
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements/ requirements/
ARG REQUIREMENTS=requirements/production.txt
RUN python -m venv /venv \
    && /venv/bin/pip install -r ${REQUIREMENTS}

# ---------- dev ----------
FROM builder AS dev
ENV PATH="/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.dev
RUN /venv/bin/pip install -r requirements/dev.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ---------- prod ----------
FROM base AS prod
ENV PATH="/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.production
COPY --from=builder /venv /venv
COPY . .
# Collect static into the image so whitenoise can serve it (no external
# static host needed for the API/admin surface). A dummy secret keeps
# collectstatic happy at build time; the real one is injected at runtime.
RUN DJANGO_SECRET_KEY=build-only DJANGO_ALLOWED_HOSTS=localhost \
    EMAIL_HOST=build-only DATABASE_URL=postgres://u:p@localhost/db \
    python manage.py collectstatic --noinput
RUN useradd --system --uid 1001 --home /app app \
    && chown -R app:app /app
USER app
EXPOSE 8000
# Overridden to `celery -A config worker|beat -l info` for the
# worker/scheduler services.
CMD ["gunicorn", "config.wsgi:application", "-c", "gunicorn.conf.py"]
