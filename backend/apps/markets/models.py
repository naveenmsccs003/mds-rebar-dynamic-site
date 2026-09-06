"""
Multi-country architecture (spec §42): Country -> Region -> Office, as
data, never hardcoded across frontend components. Initial markets (USA,
Canada, UK, UAE, India, Australia, Malaysia, Saudi Arabia, Qatar) are
seeded as Country rows with real office/contact details left as
[CONTENT PLACEHOLDER — ADMIN TO COMPLETE] — never fabricated.
"""
from django.db import models


class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=2, unique=True, help_text="ISO 3166-1 alpha-2, e.g. 'US'.")
    is_active_market = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "markets_country"
        ordering = ["display_order", "name"]
        verbose_name_plural = "countries"

    def __str__(self) -> str:
        return self.name


class Region(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="regions")
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "markets_region"
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["country", "name"], name="uniq_region_per_country")]

    def __str__(self) -> str:
        return f"{self.name}, {self.country.name}"


class Office(models.Model):
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="offices")
    name = models.CharField(max_length=150)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = "markets_office"
        ordering = ["name"]
        indexes = [models.Index(fields=["region", "is_published"])]

    def __str__(self) -> str:
        return self.name
