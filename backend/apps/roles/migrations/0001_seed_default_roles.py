"""
Seeds the ten initial roles (docs/RBAC_DESIGN.md) as empty Django Groups.
Permission assignment happens in Phase 3, once auth/session/permission
wiring exists to actually exercise them — seeding the groups now just
means they're available to assign users to from day one.
"""
from django.db import migrations

DEFAULT_ROLES = [
    "SuperAdmin",
    "Admin",
    "ContentManager",
    "HR",
    "Marketing",
    "BusinessDevelopment",
    "ResourceManager",
    "KnowledgeBaseMember",
    "Staff",
    "Auditor",
]


def create_default_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for name in DEFAULT_ROLES:
        Group.objects.get_or_create(name=name)


def remove_default_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=DEFAULT_ROLES).delete()


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_default_groups, remove_default_groups),
    ]
