import pytest
from django.db import IntegrityError

from .models import Country, Region


@pytest.mark.django_db
def test_country_code_is_unique():
    Country.objects.create(name="United States", code="US")
    with pytest.raises(IntegrityError):
        Country.objects.create(name="United States Duplicate", code="US")


@pytest.mark.django_db
def test_region_name_unique_per_country_but_not_globally():
    us = Country.objects.create(name="United States", code="US")
    ca = Country.objects.create(name="Canada", code="CA")

    Region.objects.create(country=us, name="West")
    Region.objects.create(country=ca, name="West")  # same name, different country: allowed

    with pytest.raises(IntegrityError):
        Region.objects.create(country=us, name="West")  # duplicate within the same country: rejected
