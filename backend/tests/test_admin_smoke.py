"""
Phase 2 smoke test: every registered ModelAdmin's changelist and add
page render without error for a superuser. `manage.py check` doesn't
catch runtime issues like a misconfigured inline FK or
`prepopulated_fields` pointing at a non-existent field — this does.
"""
import pytest
from django.contrib import admin
from django.test import Client, RequestFactory
from django.urls import reverse

from apps.users.models import User


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(email="admin@mdsrebar.example", password="not-a-real-password-123")


@pytest.fixture
def admin_client(superuser):
    client = Client()
    client.force_login(superuser)
    return client


@pytest.fixture
def admin_request(superuser):
    request = RequestFactory().get("/admin/")
    request.user = superuser
    return request


@pytest.mark.django_db
def test_every_registered_model_changelist_loads(admin_client):
    failures = []
    for model in admin.site._registry:
        url = reverse(
            f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist"
        )
        response = admin_client.get(url)
        if response.status_code != 200:
            failures.append((model._meta.label, url, response.status_code))
    assert not failures, f"Admin changelists failed to load: {failures}"


@pytest.mark.django_db
def test_every_addable_model_add_page_loads(admin_client, admin_request):
    failures = []
    for model, model_admin in admin.site._registry.items():
        if not model_admin.has_add_permission(admin_request):
            continue
        url = reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_add")
        response = admin_client.get(url)
        if response.status_code != 200:
            failures.append((model._meta.label, url, response.status_code))
    assert not failures, f"Admin add pages failed to load: {failures}"
