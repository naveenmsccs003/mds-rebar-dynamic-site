from django.contrib import admin

from .models import JobPosting


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ("title", "department", "location", "employment_type", "is_active")
    list_filter = ("is_active", "employment_type", "department")
    search_fields = ("title", "department")
    prepopulated_fields = {"slug": ("title",)}
