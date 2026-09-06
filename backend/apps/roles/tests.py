import pytest
from django.contrib.auth.models import Group


@pytest.mark.django_db
def test_default_roles_are_seeded_by_migration():
    """The `0001_seed_default_roles` migration already ran as part of
    test-DB setup — this asserts the ten roles from docs/RBAC_DESIGN.md
    actually exist, so a future edit to the seed list can't silently
    drop one without a test noticing."""
    seeded_names = set(Group.objects.values_list("name", flat=True))
    expected = {
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
    }
    assert expected <= seeded_names
