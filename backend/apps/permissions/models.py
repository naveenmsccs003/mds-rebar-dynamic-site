"""
No models here. Authorization uses Django's built-in `auth.Permission`
(standard + custom `Meta.permissions` declared on the owning app's
models, e.g. `services.publish_service`) per docs/RBAC_DESIGN.md. This
app holds reusable DRF permission classes (`HasModelPermission` and
friends), added in Phase 3 once there are protected endpoints to guard.
"""
