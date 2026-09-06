from django.contrib import admin

from apps.pages.admin import PublishableContentAdmin

from .models import News


@admin.register(News)
class NewsAdmin(PublishableContentAdmin):
    list_display = PublishableContentAdmin.list_display + ("category",)
