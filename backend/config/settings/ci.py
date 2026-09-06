"""
CI settings for the integration-test job (docs/CI_CD.md — "DRF API test
suite against a real Postgres/Redis service in the CI runner").

Same fast test knobs as `test.py`, but the database and cache come from
the CI service containers via env, so PostgreSQL-only behaviour (the
`SELECT ... FOR UPDATE` reference-number concurrency test) actually runs.
"""
from .test import *  # noqa: F403

DATABASES = {"default": env.db("DATABASE_URL")}  # noqa: F405

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://localhost:6379/1"),  # noqa: F405
    }
}
