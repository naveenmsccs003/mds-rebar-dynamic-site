import pytest
from django.db import IntegrityError

from .models import User


@pytest.mark.django_db
def test_create_user_requires_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="whatever-123")


@pytest.mark.django_db
def test_create_user_normalizes_email_and_hashes_password():
    user = User.objects.create_user(email="Jane@Example.com", password="a-real-password-123")
    assert user.email == "Jane@example.com"  # domain is lowercased by normalize_email
    assert user.password != "a-real-password-123"  # never stored in plaintext
    assert user.check_password("a-real-password-123")
    assert user.is_staff is False and user.is_superuser is False


@pytest.mark.django_db
def test_create_superuser_sets_staff_and_superuser_flags():
    user = User.objects.create_superuser(email="admin@example.com", password="a-real-password-123")
    assert user.is_staff is True
    assert user.is_superuser is True


@pytest.mark.django_db
def test_create_superuser_rejects_is_staff_false():
    with pytest.raises(ValueError):
        User.objects.create_superuser(email="admin@example.com", password="x", is_staff=False)


@pytest.mark.django_db
def test_email_is_unique():
    User.objects.create_user(email="dup@example.com", password="x")
    with pytest.raises(IntegrityError):
        User.objects.create_user(email="dup@example.com", password="y")


@pytest.mark.django_db
def test_is_locked_reflects_locked_until():
    from django.utils import timezone

    user = User.objects.create_user(email="locked@example.com", password="x")
    assert user.is_locked is False

    user.locked_until = timezone.now() + timezone.timedelta(minutes=15)
    assert user.is_locked is True

    user.locked_until = timezone.now() - timezone.timedelta(minutes=1)
    assert user.is_locked is False
