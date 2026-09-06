"""
Services (spec §10/§11): ONE reusable data model backing every service —
Rebar Detailing, Rebar Estimation, ... — and any future service, never
one React page/model per service.
"""
from django.db import models

from apps.media.models import MediaAsset
from apps.pages.models import PublishStatus
from apps.technology.models import Technology


class Service(models.Model):
    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=150, unique=True, help_text="Drives /services/<slug>.")

    short_description = models.CharField(max_length=300, blank=True)
    long_description = models.TextField(blank=True, help_text="Sanitized HTML (docs/SECURITY.md).")

    hero_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    icon = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="service_icon_set+"
    )

    business_value = models.TextField(blank=True)
    standards_codes = models.TextField(blank=True, help_text="Applicable industry standards/codes.")
    deliverables = models.TextField(blank=True)
    output_formats = models.CharField(max_length=255, blank=True, help_text="e.g. 'DWG, PDF, REVIT'.")

    technology = models.ManyToManyField(Technology, blank=True, related_name="services")

    display_order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.DRAFT)

    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=160, blank=True)
    seo_keywords = models.CharField(max_length=255, blank=True)
    og_image = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="service_og_set+"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "services_service"
        ordering = ["display_order", "name"]
        permissions = [("publish_service", "Can publish service")]
        indexes = [models.Index(fields=["status", "display_order"])]

    def __str__(self) -> str:
        return self.name


class ServiceCapability(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="capabilities")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "services_servicecapability"
        ordering = ["display_order"]

    def __str__(self) -> str:
        return self.title


class ServiceProcessStep(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="process_steps")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    step_number = models.PositiveIntegerField()

    class Meta:
        db_table = "services_serviceprocessstep"
        ordering = ["step_number"]
        constraints = [
            models.UniqueConstraint(fields=["service", "step_number"], name="uniq_process_step_per_service")
        ]

    def __str__(self) -> str:
        return f"{self.service.name} step {self.step_number}"


class ServiceFAQ(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="faqs")
    question = models.CharField(max_length=255)
    answer = models.TextField()
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "services_servicefaq"
        ordering = ["display_order"]
        verbose_name = "Service FAQ"
        verbose_name_plural = "Service FAQs"

    def __str__(self) -> str:
        return self.question
