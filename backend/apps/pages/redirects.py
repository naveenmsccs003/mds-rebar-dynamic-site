"""
Slug-change redirect bookkeeping (docs/SEO.md "URLs": a slug change
creates a 301 old -> new so links and rankings aren't broken).

CMS write paths call `create_redirect()` when they detect a public slug
changed. Phase 4 provides the helper + model; models with real public
slugs (Service, Project, Blog, ...) wire it in during their own phases.
"""
from __future__ import annotations

from .models import Redirect


def create_redirect(old_path: str, new_path: str, *, user=None, permanent: bool = True):
    """Upsert a redirect `old_path -> new_path`, keeping the redirect
    graph flat:

    * a no-op (old == new) is ignored;
    * any existing redirect that *pointed at* `old_path` is repointed to
      `new_path` (so two renames don't create a 301 -> 301 chain);
    * an existing row for `old_path` is updated in place.
    """
    old_path = (old_path or "").strip()
    new_path = (new_path or "").strip()
    if not old_path or not new_path or old_path == new_path:
        return None

    Redirect.objects.filter(new_path=old_path).exclude(old_path=new_path).update(
        new_path=new_path
    )
    Redirect.objects.filter(old_path=new_path).delete()  # the new path is live again

    obj, _ = Redirect.objects.update_or_create(
        old_path=old_path,
        defaults={"new_path": new_path, "is_permanent": permanent, "created_by": user},
    )
    return obj
