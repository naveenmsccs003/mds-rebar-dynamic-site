"""
Turn a user's effective authorization into a JSON-serialisable payload
for the admin SPA to bootstrap with (docs/API_DESIGN.md "Auth" — the SPA
uses this only to decide what UI to show; the backend still re-checks
every request via `apps.permissions.permissions`).
"""
from __future__ import annotations


def permissions_payload(user) -> dict:
    """`{roles, permissions, is_superuser, is_staff}` for an authenticated
    user. `permissions` is the full effective set (group + direct), sorted;
    for a superuser Django returns every permission, which is intentional.
    """
    return {
        "roles": sorted(user.groups.values_list("name", flat=True)),
        "permissions": sorted(user.get_all_permissions()),
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
    }
