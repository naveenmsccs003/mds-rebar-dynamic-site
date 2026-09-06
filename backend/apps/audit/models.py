"""
Append-only audit trail (spec §39/§73, docs/SECURITY.md). No admin
permission grants update/delete on this model (enforced in `admin.py`
and, from Phase 3 onward, at the API permission-class level too) — an
audit record that can be edited by the people it's watching isn't audit.
"""
from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="Null for system-initiated actions (e.g. scheduled publishing).",
    )
    action = models.CharField(max_length=100, help_text="e.g. 'user.created', 'service.published'.")
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=64)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_auditlog"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["action", "-timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.action} on {self.entity_type}:{self.entity_id}"
