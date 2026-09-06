import pytest
from django.contrib.auth.models import Permission
from django.db import IntegrityError

from apps.pages.models import PublishStatus

from .models import Service


@pytest.mark.django_db
def test_slug_must_be_unique():
    Service.objects.create(name="Rebar Detailing", slug="rebar-detailing")
    with pytest.raises(IntegrityError):
        Service.objects.create(name="Rebar Detailing 2", slug="rebar-detailing")


@pytest.mark.django_db
def test_defaults_to_draft_status():
    service = Service.objects.create(name="Rebar Estimation", slug="rebar-estimation")
    assert service.status == PublishStatus.DRAFT


@pytest.mark.django_db
def test_publish_permission_is_registered():
    """docs/RBAC_DESIGN.md requires publish to be a separate permission
    from edit — verifies the custom Meta.permissions actually produced a
    real, queryable Permission row (via the post-migrate signal)."""
    assert Permission.objects.filter(codename="publish_service", content_type__app_label="services").exists()
