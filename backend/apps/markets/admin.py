from django.contrib import admin

from .models import Country, Office, Region


class RegionInline(admin.TabularInline):
    model = Region
    extra = 0


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active_market", "display_order")
    list_filter = ("is_active_market",)
    search_fields = ("name", "code")
    inlines = [RegionInline]


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("name", "country")
    list_filter = ("country",)


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "is_published")
    list_filter = ("is_published", "region__country")
    search_fields = ("name", "address")
