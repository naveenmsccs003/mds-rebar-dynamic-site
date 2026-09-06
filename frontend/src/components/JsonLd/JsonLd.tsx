/**
 * Structured data (docs/SEO.md "Structured data"). Emits a
 * `<script type="application/ld+json">` from data already on the content
 * model — never fabricated fields. JSON-LD is valid anywhere in the
 * document, so this renders inline where it is mounted; one page renders
 * per route, so blocks don't accumulate across navigation.
 *
 * schema.org builders live in `./schemas`.
 */
export interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // App-authored, not user input; still serialise to one string and
      // neutralise `<` so nothing can break out of the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
