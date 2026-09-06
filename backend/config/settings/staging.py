from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])  # noqa: F405

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# TLS terminates at the load balancer / ingress (docs/DEPLOYMENT.md), so
# trust its X-Forwarded-Proto for request.is_secure() / the SSL redirect
# / robots.txt scheme. The proxy must strip any client-sent header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# CSP starts in report-only in staging so a real page load can surface
# violations before it is enforced in production.
CSP_REPORT_ONLY = env.bool("CSP_REPORT_ONLY", default=True)  # noqa: F405

# Real SMTP for password-reset / notification mail (base.py defaults to
# the console backend). Falls back to console if EMAIL_HOST is unset.
if env("EMAIL_HOST", default=""):  # noqa: F405
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
