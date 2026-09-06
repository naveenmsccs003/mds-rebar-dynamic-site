from django.contrib import admin

from apps.pages.admin import PublishableContentAdmin

from .models import CSRPost


@admin.register(CSRPost)
class CSRPostAdmin(PublishableContentAdmin):
    list_display = PublishableContentAdmin.list_display + ("focus_area",)
