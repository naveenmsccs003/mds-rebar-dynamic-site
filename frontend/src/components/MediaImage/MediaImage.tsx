/**
 * Renders a `MediaRef` from the content APIs: the real `<img>` once the
 * upload has a resolved `url` (docs/FILE_STORAGE.md — signed public
 * URL), otherwise a labelled placeholder box so a page never shows a
 * broken image while an asset is still being processed or hasn't been
 * added yet.
 */
import type { MediaRef } from "../../features/services/types";

export interface MediaImageProps {
  media: MediaRef | null | undefined;
  /** Used when the asset has no alt text of its own. */
  fallbackAlt?: string;
  className?: string;
}

export function MediaImage({ media, fallbackAlt = "", className = "" }: MediaImageProps) {
  const alt = media?.alt_text || fallbackAlt;

  if (media?.url) {
    return (
      <img
        src={media.url}
        alt={alt}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        loading="lazy"
        className={`media-image ${className}`.trim()}
      />
    );
  }

  return (
    <span className={`media-image media-image--placeholder ${className}`.trim()} role="img" aria-label={alt || "Image"}>
      {alt || "Image"}
    </span>
  );
}
