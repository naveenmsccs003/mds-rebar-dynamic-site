"""
Apply `apps.roles.role_permissions.ROLE_PERMISSIONS` to the ten seeded
Django groups (docs/RBAC_DESIGN.md).

Idempotent: it sets each group's permission set to exactly what the map
resolves to, so running it repeatedly is a no-op and removing a selector
revokes the permission on the next run. Run it after deploy and after any
migration that introduces a new model or custom permission.

    python manage.py sync_roles
    python manage.py sync_roles --dry-run
"""
from __future__ import annotations

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.roles.role_permissions import ROLE_PERMISSIONS, permissions_for_role


class Command(BaseCommand):
    help = "Sync the RBAC roles' Django permissions from apps.roles.role_permissions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        missing_groups: list[str] = []
        total_changes = 0

        with transaction.atomic():
            for role_name in ROLE_PERMISSIONS:
                try:
                    group = Group.objects.get(name=role_name)
                except Group.DoesNotExist:
                    missing_groups.append(role_name)
                    continue

                target = set(permissions_for_role(role_name))
                current = set(group.permissions.all())
                added = target - current
                removed = current - target

                if added or removed:
                    total_changes += len(added) + len(removed)
                    self.stdout.write(
                        f"{role_name}: +{len(added)} / -{len(removed)} "
                        f"(now {len(target)} permissions)"
                    )
                    for perm in sorted(added, key=lambda p: p.content_type.app_label + p.codename):
                        self.stdout.write(f"    + {perm.content_type.app_label}.{perm.codename}")
                    for perm in sorted(removed, key=lambda p: p.content_type.app_label + p.codename):
                        self.stdout.write(f"    - {perm.content_type.app_label}.{perm.codename}")
                else:
                    self.stdout.write(f"{role_name}: unchanged ({len(target)} permissions)")

                if not dry_run:
                    group.permissions.set(target)

            if missing_groups:
                raise CommandError(
                    "Missing role groups (run migrations first): "
                    + ", ".join(missing_groups)
                )
            if dry_run:
                transaction.set_rollback(True)

        if dry_run:
            self.stdout.write(self.style.WARNING(f"Dry run — {total_changes} change(s) not written."))
        elif total_changes:
            self.stdout.write(self.style.SUCCESS(f"Applied {total_changes} permission change(s)."))
        else:
            self.stdout.write(self.style.SUCCESS("Roles already in sync."))
