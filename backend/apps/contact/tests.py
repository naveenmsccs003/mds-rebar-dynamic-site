import pytest
from django.db import IntegrityError

from .models import Enquiry
from .services import create_enquiry, generate_enquiry_reference


@pytest.mark.django_db
def test_generate_enquiry_reference_format():
    assert generate_enquiry_reference(year=2026) == "MDS-E-2026-000001"


@pytest.mark.django_db
def test_generate_enquiry_reference_increments():
    assert generate_enquiry_reference(year=2026) == "MDS-E-2026-000001"
    assert generate_enquiry_reference(year=2026) == "MDS-E-2026-000002"


@pytest.mark.django_db
def test_create_enquiry_assigns_reference_and_defaults_to_new_status():
    enquiry = create_enquiry(name="Jane", email="jane@example.com", message="Hello")
    assert enquiry.public_reference.startswith("MDS-E-")
    assert enquiry.status == "new"


@pytest.mark.django_db
def test_public_reference_must_be_unique():
    Enquiry.objects.create(public_reference="MDS-E-2026-000001", name="A", email="a@example.com", message="x")
    with pytest.raises(IntegrityError):
        Enquiry.objects.create(public_reference="MDS-E-2026-000001", name="B", email="b@example.com", message="y")
