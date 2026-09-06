from django.apps import AppConfig


class PagesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pages"

    def ready(self):
        from django.db.models.signals import post_delete, post_save

        from .cache import invalidate_site_settings
        from .models import PageSection, SiteSetting
        from .response_cache import bumper

        post_save.connect(
            invalidate_site_settings, sender=SiteSetting, dispatch_uid="pages.sitesetting.cache"
        )
        post_delete.connect(
            invalidate_site_settings, sender=SiteSetting, dispatch_uid="pages.sitesetting.cache"
        )

        # Public response-cache invalidation (docs/PERFORMANCE.md). Each
        # namespace is bumped when any model whose rows it serves is
        # written — wired here so it's one place to audit.
        from apps.careers.models import JobPosting
        from apps.news.models import News
        from apps.portfolio.models import Project, ProjectDocument, ProjectImage
        from apps.resources.models import Resource
        from apps.services.models import (
            Service,
            ServiceCapability,
            ServiceFAQ,
            ServiceProcessStep,
        )

        namespaces = {
            "pages": [PageSection],
            "services": [Service, ServiceCapability, ServiceProcessStep, ServiceFAQ],
            "news": [News],
            "portfolio": [Project, ProjectImage, ProjectDocument],
            "resources": [Resource],
            "careers": [JobPosting],
        }
        for namespace, models in namespaces.items():
            receiver = bumper(namespace)
            for model in models:
                uid = f"respcache.{namespace}.{model._meta.model_name}"
                post_save.connect(receiver, sender=model, dispatch_uid=uid + ".save", weak=False)
                post_delete.connect(receiver, sender=model, dispatch_uid=uid + ".delete", weak=False)
