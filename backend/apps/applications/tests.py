import pytest

from apps.careers.models import JobPosting

from .models import ApplicationStatus, JobApplication


@pytest.mark.django_db
def test_defaults_to_new_status():
    job = JobPosting.objects.create(title="Detailer", slug="detailer")
    application = JobApplication.objects.create(job=job, name="Jane Doe", email="jane@example.com")
    assert application.status == ApplicationStatus.NEW
    assert application.uuid is not None
