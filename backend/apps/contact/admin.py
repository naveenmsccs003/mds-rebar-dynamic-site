from django.contrib import admin

from .models import Enquiry, EnquiryNote


class EnquiryNoteInline(admin.TabularInline):
    model = EnquiryNote
    extra = 0
    readonly_fields = ("author", "created_at")


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ("public_reference", "name", "enquiry_type", "status", "assigned_to", "created_at")
    list_filter = ("status", "enquiry_type")
    search_fields = ("public_reference", "name", "email", "company")
    readonly_fields = ("public_reference", "ip_address", "user_agent", "created_at")
    inlines = [EnquiryNoteInline]
