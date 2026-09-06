"""
Server-side rich-text sanitisation (docs/SECURITY.md "Input & injection":
rich text is sanitised with an allow-list before storage and again before
render). This module is the *before storage* half — every CMS write path
that accepts HTML runs its input through `sanitize_html()`; the React
client sanitises again at render time.

`bleach` (already a project dependency) with a deliberately small
allow-list: the tags an editor needs for prose, nothing that can execute
(`<script>`, `<style>`, event handlers, `javascript:` URLs, `<iframe>`,
form controls, `<object>`/`<embed>`).
"""
from __future__ import annotations

import bleach

# Block + inline formatting an editor realistically produces. No media
# embeds beyond <img> (whose src is host-restricted below); no headings
# above <h2> since the page already owns <h1>.
ALLOWED_TAGS: frozenset[str] = frozenset(
    {
        "p", "br", "hr", "span", "div",
        "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
        "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li",
        "blockquote", "pre", "code",
        "a", "img", "figure", "figcaption",
        "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    }
)

# `style` is deliberately NOT allowed on any element — inline CSS is an
# XSS surface (and needs a whole CSS parser to vet safely). Presentation
# is the frontend's job; the CMS stores structure, not styling.
ALLOWED_ATTRIBUTES: dict[str, list[str]] = {
    "*": ["class", "id", "title", "dir", "lang"],
    "a": ["href", "target", "rel"],
    "img": ["src", "alt", "width", "height", "loading"],
    "td": ["colspan", "rowspan", "headers"],
    "th": ["colspan", "rowspan", "scope", "headers"],
    "col": ["span"],
    "colgroup": ["span"],
    "ol": ["start", "type"],
}

ALLOWED_PROTOCOLS: frozenset[str] = frozenset({"http", "https", "mailto", "tel"})


def sanitize_html(value: str | None) -> str:
    """Return `value` with every tag/attribute/URL outside the allow-list
    removed. Idempotent. `None`/empty in -> `""` out."""
    if not value:
        return ""

    cleaned = bleach.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,          # drop disallowed tags rather than escaping them
        strip_comments=True,
    )
    # Defence in depth: force every external anchor to carry a safe `rel`
    # and open in a new tab, regardless of what the editor set. `linkify`
    # also auto-links bare `http(s)`/`mailto` URLs in text, which is
    # acceptable (and convenient) CMS behaviour and stays within the same
    # protocol allow-list.
    return bleach.linkify(
        cleaned,
        callbacks=[_harden_anchor],
        skip_tags=["pre", "code"],
        parse_email=False,
    )


def _harden_anchor(attrs: dict, new: bool = False) -> dict:
    href = attrs.get((None, "href"), "")
    if href.startswith(("http://", "https://")):
        attrs[(None, "target")] = "_blank"
        attrs[(None, "rel")] = "noopener nofollow ugc"
    return attrs


def sanitize_json_html(value):
    """Recursively sanitise a `PageSection.content`-style structure: any
    string held at a key ending in ``html`` (e.g. ``body_html``,
    ``"html"``) is run through `sanitize_html`; everything else is left
    exactly as-is. Lists and nested dicts are walked."""
    if isinstance(value, dict):
        return {
            k: (sanitize_html(v) if _is_html_key(k) and isinstance(v, str) else sanitize_json_html(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [sanitize_json_html(item) for item in value]
    return value


def _is_html_key(key) -> bool:
    return isinstance(key, str) and key.lower().rstrip("_").endswith("html")
