"""
Custom user model (docs/DATABASE_DESIGN.md "users / accounts / roles /
permissions"). Introduced now, before any migration has ever been run
against a real database — swapping AUTH_USER_MODEL later is destructive,
so this is deliberately a Phase 2 decision.

Email is the login identifier (spec has no requirement for usernames,
and email-based login is the norm for a B2B engineering platform).
Role assignment uses Django's built-in Group/Permission machinery
(docs/RBAC_DESIGN.md) rather than a bespoke Role model — `groups` is
inherited from PermissionsMixin.
"""
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user. `groups` (from PermissionsMixin) is how roles from
    docs/RBAC_DESIGN.md (SuperAdmin, Admin, ContentManager, ...) are
    assigned — no separate Role model duplicates Django's Group."""

    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    is_active = models.BooleanField(
        default=True,
        help_text="Unselect instead of deleting accounts (spec §19/§78 data retention).",
    )
    is_staff = models.BooleanField(
        default=False, help_text="Can access the admin/staff area."
    )

    # Brute-force protection fields (docs/SECURITY.md "AuthN").
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    failed_login_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users_user"
        ordering = ["email"]

    def __str__(self) -> str:
        return self.email

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self) -> str:
        return self.first_name or self.email

    @property
    def is_locked(self) -> bool:
        return bool(self.locked_until and self.locked_until > timezone.now())

    # --- Brute-force lockout (docs/SECURITY.md "AuthN") -----------------
    # The auth flow in apps.accounts calls these; the thresholds live in
    # settings (AUTH_LOCKOUT_*) so ops can tune them without a deploy.

    def register_failed_login(self) -> None:
        """Record one failed password attempt and, once the threshold is
        crossed, (re)arm a progressive lockout — the window doubles with
        every further failure, capped at AUTH_LOCKOUT_MAX_SECONDS."""
        self.failed_login_count = (self.failed_login_count or 0) + 1

        threshold = settings.AUTH_LOCKOUT_THRESHOLD
        if self.failed_login_count >= threshold:
            overshoot = self.failed_login_count - threshold  # 0 on the first lock
            seconds = settings.AUTH_LOCKOUT_BASE_SECONDS * (2**overshoot)
            seconds = min(seconds, settings.AUTH_LOCKOUT_MAX_SECONDS)
            self.locked_until = timezone.now() + timedelta(seconds=seconds)

        self.save(update_fields=["failed_login_count", "locked_until", "updated_at"])

    def register_successful_login(self, ip_address: str | None = None) -> None:
        """Clear the failure counter/lock and stamp the login metadata."""
        self.failed_login_count = 0
        self.locked_until = None
        self.last_login_ip = ip_address
        self.last_login = timezone.now()
        self.save(
            update_fields=[
                "failed_login_count",
                "locked_until",
                "last_login_ip",
                "last_login",
                "updated_at",
            ]
        )

    def clear_lockout(self) -> None:
        """Admin action / support override: unlock without a login."""
        self.failed_login_count = 0
        self.locked_until = None
        self.save(update_fields=["failed_login_count", "locked_until", "updated_at"])

    @property
    def lockout_seconds_remaining(self) -> int:
        if not self.is_locked:
            return 0
        return int((self.locked_until - timezone.now()).total_seconds()) + 1
