"""
No Role model here on purpose (docs/RBAC_DESIGN.md): roles are Django
`auth.Group` objects, and permissions are Django `auth.Permission`
objects (standard ones plus custom ones declared per-model, e.g.
`services.publish`). This app owns the data migration that seeds the
initial ten roles as empty groups; Phase 3 (Authentication + RBAC)
assigns the actual permission sets to each group once every domain
app's custom permissions exist.
"""
