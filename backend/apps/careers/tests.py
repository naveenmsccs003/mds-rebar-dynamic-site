import pytest
from django.db import IntegrityError

from .models import JobPosting


@pytest.mark.django_db
def test_slug_must_be_unique():
    JobPosting.objects.create(title="Rebar Detailer", slug="rebar-detailer")
    with pytest.raises(IntegrityError):
        JobPosting.objects.create(title="Rebar Detailer 2", slug="rebar-detailer")


@pytest.mark.django_db
def test_defaults_to_active():
    posting = JobPosting.objects.create(title="BIM Engineer", slug="bim-engineer")
    assert posting.is_active is True
