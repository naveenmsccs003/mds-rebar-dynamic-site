"""
Contact / business enquiries (spec §18). Reference numbers reuse the
same pattern as quotations but with an 'E' marker (MDS-E-2026-000001) —
see `services.generate_enquiry_reference`.
"""
from django.conf import settings
from django.db import models


class EnquiryType(models.TextChoices):
    CONTACT = "contact", "Contact"
    BUSINESS = "business", "Business Enquiry"


class EnquiryStatus(models.TextChoices):
    NEW = "new", "New"
    ASSIGNED = "assigned", "Assigned"
    IN_PROGRESS = "in_progress", "In Progress"
    RESPONDED = "responded", "Responded"
    CLOSED = "closed", "Closed"
    SPAM = "spam", "Spam"


class EnquiryReferenceSequence(models.Model):
    year = models.PositiveIntegerField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "contact_referencesequence"


class Enquiry(models.Model):
    public_reference = models.CharField(max_length=30, unique=True, editable=False, db_index=True)
    enquiry_type = models.CharField(max_length=10, choices=EnquiryType.choices, default=EnquiryType.CONTACT)

    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    company = models.CharField(max_length=150, blank=True)
    message = models.TextField()

    status = models.CharField(max_length=20, choices=EnquiryStatus.choices, default=EnquiryStatus.NEW)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_enquiry"
        ordering = ["-created_at"]
        verbose_name_plural = "enquiries"
        permissions = [
            ("assign_enquiry", "Can assign enquiry"),
            ("respond_enquiry", "Can respond to enquiry"),
            ("close_enquiry", "Can close enquiry"),
        ]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return self.public_reference


class EnquiryNote(models.Model):
    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_enquirynote"
        ordering = ["-created_at"]
