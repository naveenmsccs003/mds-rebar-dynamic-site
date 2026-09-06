from django.contrib import admin

from .models import Service, ServiceCapability, ServiceFAQ, ServiceProcessStep


class ServiceCapabilityInline(admin.TabularInline):
    model = ServiceCapability
    extra = 0


class ServiceProcessStepInline(admin.TabularInline):
    model = ServiceProcessStep
    extra = 0


class ServiceFAQInline(admin.TabularInline):
    model = ServiceFAQ
    extra = 0


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "display_order")
    list_filter = ("status",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ("technology",)
    inlines = [ServiceCapabilityInline, ServiceProcessStepInline, ServiceFAQInline]
