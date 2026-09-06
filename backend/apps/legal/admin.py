from django.contrib import admin

from .models import LegalDocument


@admin.register(LegalDocument)
class LegalDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "document_type", "version", "is_published", "effective_date")
    list_filter = ("is_published",)
