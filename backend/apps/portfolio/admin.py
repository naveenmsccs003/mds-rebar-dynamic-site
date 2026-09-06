from django.contrib import admin

from .models import Project, ProjectDocument, ProjectImage


class ProjectImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 0


class ProjectDocumentInline(admin.TabularInline):
    model = ProjectDocument
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "country", "status", "is_featured", "completion_year")
    list_filter = ("status", "is_featured", "country")
    search_fields = ("title",)
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("services", "technology")
    inlines = [ProjectImageInline, ProjectDocumentInline]
