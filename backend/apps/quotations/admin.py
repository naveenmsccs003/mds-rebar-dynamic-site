from django.contrib import admin

from .models import QuoteAttachment, QuoteRequest


class QuoteAttachmentInline(admin.TabularInline):
    model = QuoteAttachment
    extra = 0


@admin.register(QuoteRequest)
class QuoteRequestAdmin(admin.ModelAdmin):
    list_display = ("public_reference", "name", "company", "status", "assigned_to", "created_at")
    list_filter = ("status",)
    search_fields = ("public_reference", "name", "company", "email")
    readonly_fields = ("public_reference", "idempotency_key", "ip_address", "user_agent", "created_at")
    inlines = [QuoteAttachmentInline]
