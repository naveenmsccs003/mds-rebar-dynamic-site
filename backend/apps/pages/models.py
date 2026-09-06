"""
CMS foundation (docs/DATABASE_DESIGN.md "pages"): homepage/about/legal
section content, global site settings, and the generic version-history
table every other CMS-editable app hangs off of.
"""
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class PublishStatus(models.TextChoices):
    """Shared publishing workflow (spec §14/§22): DRAFT -> REVIEW ->
    APPROVED -> PUBLISHED -> ARCHIVED. Editing and publishing permissions
    are kept separate at the permission-class level (docs/RBAC_DESIGN.md),
    not by this field alone."""

    DRAFT = "draft", "Draft"
    REVIEW = "review", "Review"
    APPROVED = "approved", "Approved"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class SEOFields(models.Model):
    """Mixin of the CMS-editable SEO fields required on every public
    content model (docs/SEO.md) — never hardcoded per page in React."""

    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=160, blank=True)
    seo_keywords = models.CharField(max_length=255, blank=True)
    canonical_url = models.URLField(blank=True)
    og_title = models.CharField(max_length=70, blank=True)
    og_description = models.CharField(max_length=200, blank=True)
    og_image = models.ForeignKey(
        "media.MediaAsset", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        abstract = True


class Tag(models.Model):
    """Shared across News/Blog/Event/CSR (docs/DATABASE_DESIGN.md 'tags
    M2M') so the same tag ('Sustainability', 'BIM') can be reused and
    filtered across content types instead of each app inventing its own."""

    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)

    class Meta:
        db_table = "pages_tag"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class PublishableContent(TimestampedModel, SEOFields):
    """Shared shape for News/Blog/Event/CSR (spec §14). Each concrete
    subclass gets its own table (Django abstract-model inheritance) —
    kept as one shared definition so the publishing workflow, SEO
    fields, and versioning hook-in are never redefined per app."""

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    summary = models.CharField(max_length=500, blank=True)
    content = models.TextField(blank=True, help_text="Sanitized HTML (docs/SECURITY.md).")
    featured_image = models.ForeignKey(
        "media.MediaAsset", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.DRAFT)
    publish_date = models.DateTimeField(null=True, blank=True)
    scheduled_publish_at = models.DateTimeField(null=True, blank=True, db_index=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name="%(class)s_set")

    class Meta:
        abstract = True
        ordering = ["-publish_date", "-created_at"]

    def __str__(self) -> str:
        return self.title


class PageSection(TimestampedModel):
    """Ordered, admin-editable sections for structurally-fixed pages
    (homepage, about, legal) whose content still must never be hardcoded
    into a React component (spec §8/§88).

    Carries the shared publishing workflow (`apps.pages.workflow`) and
    generic version history (`apps.pages.versioning`): `status` moves
    DRAFT -> REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED, `published_at` /
    `scheduled_publish_at` track go-live, and `current_version` points at
    the `ContentVersion` snapshot of the state now in `content`.
    """

    page_key = models.SlugField(max_length=100, db_index=True, help_text="e.g. 'home', 'about'.")
    section_key = models.SlugField(max_length=100, help_text="e.g. 'hero', 'why-mds'.")
    display_order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.DRAFT)
    content = models.JSONField(default=dict, blank=True, help_text="Section-specific structured fields.")

    published_at = models.DateTimeField(null=True, blank=True, help_text="Set when status last became PUBLISHED.")
    scheduled_publish_at = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text="If set on an APPROVED section, a Celery beat task publishes it at this time.",
    )
    current_version = models.ForeignKey(
        "pages.ContentVersion", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        db_table = "pages_pagesection"
        ordering = ["page_key", "display_order"]
        constraints = [
            models.UniqueConstraint(fields=["page_key", "section_key"], name="uniq_page_section")
        ]
        indexes = [
            models.Index(fields=["page_key", "status"]),
            models.Index(fields=["status", "scheduled_publish_at"]),
        ]
        permissions = [("publish_pagesection", "Can publish/unpublish/archive page sections")]

    def __str__(self) -> str:
        return f"{self.page_key}:{self.section_key}"


class SiteSetting(TimestampedModel):
    """Global admin-editable config (spec §31 cache target; §42/§88 —
    e.g. default contact info) cached in Redis and invalidated on save."""

    class ValueType(models.TextChoices):
        TEXT = "text", "Text"
        NUMBER = "number", "Number"
        BOOLEAN = "boolean", "Boolean"
        JSON = "json", "JSON"

    key = models.SlugField(max_length=100, unique=True)
    value = models.TextField(blank=True)
    value_type = models.CharField(max_length=10, choices=ValueType.choices, default=ValueType.TEXT)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "pages_sitesetting"
        ordering = ["key"]

    def __str__(self) -> str:
        return self.key


class ContentVersion(models.Model):
    """Generic version history + rollback (spec §23/§72) for any
    CMS-editable model — PageSection, Service, News, Blog, Event, CSR,
    LegalDocument, etc. — via a GenericForeignKey rather than one
    versioning table per content type."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    snapshot = models.JSONField(help_text="Full serialized field state at the time of this edit.")
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    edited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pages_contentversion"
        ordering = ["-edited_at"]
        indexes = [models.Index(fields=["content_type", "object_id", "-edited_at"])]

    def __str__(self) -> str:
        return f"{self.content_type}:{self.object_id} @ {self.edited_at:%Y-%m-%d %H:%M}"


class Redirect(TimestampedModel):
    """A 301 (or 302) from an old public path to a new one, created when a
    content slug changes so inbound links and search rankings survive
    (docs/SEO.md "URLs"). The public site / a middleware serves these in a
    later phase; Phase 4 owns the model + the `create_redirect()` helper
    that CMS slug edits call.
    """

    old_path = models.CharField(
        max_length=400, unique=True, db_index=True,
        help_text="Path only, leading slash, no host: '/services/old-slug'.",
    )
    new_path = models.CharField(max_length=400, help_text="Where 'old_path' should now go.")
    is_permanent = models.BooleanField(default=True, help_text="301 when true, 302 when false.")
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        db_table = "pages_redirect"
        ordering = ["old_path"]

    def __str__(self) -> str:
        arrow = "301" if self.is_permanent else "302"
        return f"{self.old_path} -{arrow}-> {self.new_path}"
