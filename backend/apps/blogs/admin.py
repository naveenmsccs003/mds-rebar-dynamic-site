from django.contrib import admin

from apps.pages.admin import PublishableContentAdmin

from .models import Blog


@admin.register(Blog)
class BlogAdmin(PublishableContentAdmin):
    list_display = PublishableContentAdmin.list_display + ("category",)
