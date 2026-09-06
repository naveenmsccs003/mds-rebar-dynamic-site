"""
Generic content version history + rollback (spec §23/§72,
docs/DATABASE_DESIGN.md "ContentVersion").

Any CMS-editable model can be versioned without its own history table:
`snapshot()` writes the object's full field state into a `ContentVersion`
row (GenericForeignKey), `rollback()` restores a past snapshot. Phase 4
uses this for `PageSection`; Services / News / Blog / Event / CSR /
LegalDocument hook into the same two functions in their own phases.

The API/workflow layer calls these explicitly (on create, on update, on
every workflow transition) rather than a `post_save` signal — snapshots
must record *who* made the edit, and implicit signals make rollback (a
save that must itself be versioned exactly once) hard to reason about.
"""
from __future__ import annotations

import json
from typing import Any

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime, parse_duration, parse_time

from .models import ContentVersion


def _json_safe(value: Any) -> Any:
    """Normalise to JSON primitives (datetimes -> ISO strings, Decimal ->
    str, UUID -> str) so it round-trips through `JSONField` unchanged."""
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def serialize_instance(obj) -> dict:
    """Persisted state of every local concrete field (FKs as `<name>_id`)
    plus M2M as lists of PKs, under `__m2m__`."""
    data: dict[str, Any] = {}
    for field in obj._meta.local_concrete_fields:
        data[field.attname] = _json_safe(field.value_from_object(obj))

    m2m: dict[str, list] = {}
    for field in obj._meta.local_many_to_many:
        if obj.pk is not None:
            m2m[field.name] = list(
                getattr(obj, field.name).values_list("pk", flat=True)
            )
    if m2m:
        data["__m2m__"] = m2m
    return data


def snapshot(obj, *, user=None, note: str = "") -> ContentVersion:
    """Record the current state of `obj` as a new `ContentVersion`."""
    payload = serialize_instance(obj)
    if note:
        payload["__note__"] = note
    return ContentVersion.objects.create(
        content_object=obj,
        snapshot=payload,
        edited_by=user,
    )


def versions_for(obj):
    """Version history for `obj`, newest first."""
    from django.contrib.contenttypes.models import ContentType

    ct = ContentType.objects.get_for_model(obj, for_concrete_model=True)
    return ContentVersion.objects.filter(content_type=ct, object_id=obj.pk)


_PARSERS = {
    "DateTimeField": parse_datetime,
    "DateField": parse_date,
    "TimeField": parse_time,
    "DurationField": parse_duration,
}


def _coerce(field, value):
    if value is None:
        return None
    parser = _PARSERS.get(field.get_internal_type())
    if parser is not None and isinstance(value, str):
        return parser(value)
    return value


@transaction.atomic
def rollback(obj, version: ContentVersion, *, user=None) -> None:
    """Restore `obj` to the state stored in `version`, then record the
    result as a fresh snapshot so the rollback is itself in the history
    (and the current state is never only reconstructable from a diff).

    The PK is never rewritten; unknown keys in an old snapshot (a field
    since removed) are ignored.
    """
    snap = dict(version.snapshot or {})
    m2m = snap.pop("__m2m__", {})
    snap.pop("__note__", None)

    field_by_attname = {f.attname: f for f in obj._meta.local_concrete_fields}
    pk_attname = obj._meta.pk.attname

    for attname, raw in snap.items():
        field = field_by_attname.get(attname)
        if field is None or attname == pk_attname:
            continue
        setattr(obj, attname, _coerce(field, raw))

    obj.save()

    m2m_names = {f.name for f in obj._meta.local_many_to_many}
    for name, pks in m2m.items():
        if name in m2m_names:
            getattr(obj, name).set(pks)

    snapshot(obj, user=user, note=f"rollback to version {version.pk}")
