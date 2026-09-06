from django.apps import AppConfig


class PagesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pages"

    def ready(self):
        from django.db.models.signals import post_delete, post_save

        from .cache import invalidate_site_settings
        from .models import SiteSetting

        post_save.connect(invalidate_site_settings, sender=SiteSetting, dispatch_uid="pages.sitesetting.cache")
        post_delete.connect(invalidate_site_settings, sender=SiteSetting, dispatch_uid="pages.sitesetting.cache")
