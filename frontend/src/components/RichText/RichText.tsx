import DOMPurify from "dompurify";
import { useMemo } from "react";

/**
 * Renders CMS rich-text HTML. The backend already sanitises on write
 * (apps.pages.sanitize); this sanitises again at render time —
 * docs/SECURITY.md: "sanitized before storage and again before render".
 *
 * Allow-list mirrors the server's: formatting + lists + links + images +
 * tables, no `<script>`/`<style>`/`<iframe>`, no event handlers, no
 * inline styles.
 */
const ALLOWED_TAGS = [
  "p", "br", "hr", "span", "div",
  "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
  "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
];
const ALLOWED_ATTR = [
  "class", "id", "title", "dir", "lang",
  "href", "target", "rel",
  "src", "alt", "width", "height", "loading",
  "colspan", "rowspan", "scope", "headers", "span", "start", "type",
];

export interface RichTextProps {
  html: string;
  className?: string;
}

export function RichText({ html, className }: RichTextProps) {
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(html ?? "", {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        FORBID_ATTR: ["style"],
      }),
    [html],
  );

  return (
    <div
      className={className ? `rich-text ${className}` : "rich-text"}
      // Safe: `clean` is the output of DOMPurify with an explicit allow-list.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
