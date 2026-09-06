import pytest
from django.db import IntegrityError

from .models import Project


@pytest.mark.django_db
def test_slug_must_be_unique():
    Project.objects.create(title="Tower A", slug="tower-a")
    with pytest.raises(IntegrityError):
        Project.objects.create(title="Tower A Duplicate", slug="tower-a")


@pytest.mark.django_db
def test_defaults_are_safe_for_public_listing():
    """A project must not be featured or published by default — an admin
    has to make an explicit choice before it appears on the public site
    (spec §12)."""
    project = Project.objects.create(title="Tower B", slug="tower-b")
    assert project.is_featured is False
    assert project.status == "draft"
