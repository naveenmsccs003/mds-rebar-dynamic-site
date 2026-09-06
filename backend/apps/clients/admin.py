from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "display_order", "is_published")
    list_filter = ("is_published",)
    search_fields = ("name",)
