from django.contrib import admin

from .models import Testimonial


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ("author_name", "author_company", "display_order", "is_published")
    list_filter = ("is_published",)
    search_fields = ("author_name", "author_company")
