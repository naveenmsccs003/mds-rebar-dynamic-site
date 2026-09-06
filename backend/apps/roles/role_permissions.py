"""
Declarative role -> permission map (docs/RBAC_DESIGN.md "Suggested
default role -> permission mapping").

Roles are the ten `auth.Group`s seeded empty in
`0001_seed_default_roles.py`; this module says which Django permissions
each one holds. It is applied by the idempotent `sync_roles` management
command (run on deploy / after any migration that adds a model or a
custom permission) — deliberately *not* a data migration, because the
default `add/change/delete/view` permissions are created by a
`post_migrate` signal that has not fired yet while migrations run.

## Selector syntax
Each role maps to a list of selectors, resolved against the live
`auth.Permission` table:

* ``"ALL"``                -> every permission
* ``"<app_label>"``        -> every permission in that app
* ``"<app_label>:a,b,c"``  -> permissions in that app whose codename
                              starts with ``a_`` / ``b_`` / ``c_``
                              (actions: view, add, change, delete, and
                              custom verbs like publish/assign/respond/close)
* ``"<app_label>.<codename>"`` -> that one permission exactly

Adjust as real usage emerges — this is the starting point, not a
contract.
"""
from __future__ import annotations

# Apps whose content is authored/edited through the CMS + catalog.
CONTENT_APPS = ["pages", "news", "blogs", "events", "csr", "legal"]
CATALOG_APPS = ["services", "industries", "markets", "portfolio", "resources", "technology"]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    # Unrestricted. (Group members are also `is_superuser`, which bypasses
    # permission checks entirely — the grant here just keeps the group
    # honest.)
    "SuperAdmin": ["ALL"],
    # Everything except deleting users/roles and touching raw permission
    # rows or the audit trail — see ADMIN_DENIED.
    "Admin": ["ALL"],
    "ContentManager": [
        f"{app}:view,add,change,delete" for app in CONTENT_APPS + CATALOG_APPS
    ],
    "Marketing": [
        "pages:view,add,change",
        "news:view,add,change",
        "blogs:view,add,change",
        "testimonials:view,add,change,delete",
        "clients:view,add,change,delete",
    ],
    "BusinessDevelopment": [
        # contact app owns the Enquiry model + assign/respond/close perms
        "contact:view,add,change,assign,respond,close",
        "quotations:view,add,change,assign,close",
    ],
    "HR": [
        "careers:view,add,change,delete",
        "applications:view,change,delete",
    ],
    "ResourceManager": [
        "resources:view,add,change,delete",
        "documents:view,add,change,delete",
        "media:view,add,change,delete",
    ],
    "KnowledgeBaseMember": [
        "resources.view_resource",
    ],
    # Baseline authenticated access only — no model write permissions.
    "Staff": [],
    "Auditor": [
        "audit.view_auditlog",
    ],
}

# Removed from the "ALL" grant for the Admin role (never for SuperAdmin).
# Audit add/change/delete is denied to everyone at the API layer as well
# (append-only, docs/SECURITY.md) — listing it here keeps the group's
# permission set matching that guarantee.
ADMIN_DENIED: frozenset[str] = frozenset(
    {
        "users.delete_user",
        "auth.delete_group",
        "auth.add_permission",
        "auth.change_permission",
        "auth.delete_permission",
        "audit.add_auditlog",
        "audit.change_auditlog",
        "audit.delete_auditlog",
    }
)

# Roles whose "ALL" is filtered by ADMIN_DENIED.
_DENY_FILTERED_ROLES = frozenset({"Admin"})


def _selector_q(selector: str):
    from django.db.models import Q

    if selector == "ALL":
        return Q()
    if ":" in selector:
        app_label, actions = selector.split(":", 1)
        verbs = [a.strip() for a in actions.split(",") if a.strip()]
        verb_q = Q()
        for verb in verbs:
            verb_q |= Q(codename__startswith=f"{verb}_")
        return Q(content_type__app_label=app_label) & verb_q
    if "." in selector:
        app_label, codename = selector.split(".", 1)
        return Q(content_type__app_label=app_label, codename=codename)
    return Q(content_type__app_label=selector)


def resolve_permissions(selectors, *, exclude: frozenset[str] = frozenset()):
    """Return a `Permission` queryset for the given selector list."""
    from django.contrib.auth.models import Permission
    from django.db.models import Q

    if "ALL" in selectors:
        qs = Permission.objects.all()
    elif not selectors:
        return Permission.objects.none()
    else:
        q = Q()
        for selector in selectors:
            q |= _selector_q(selector)
        qs = Permission.objects.filter(q)

    for item in exclude:
        app_label, codename = item.split(".", 1)
        qs = qs.exclude(content_type__app_label=app_label, codename=codename)
    return qs.select_related("content_type")


def permissions_for_role(role_name: str):
    """Resolved `Permission` queryset for one role name."""
    selectors = ROLE_PERMISSIONS[role_name]
    exclude = ADMIN_DENIED if role_name in _DENY_FILTERED_ROLES else frozenset()
    return resolve_permissions(selectors, exclude=exclude)
