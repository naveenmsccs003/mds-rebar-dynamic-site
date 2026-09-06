/**
 * Media library hooks. The list/CRUD come from `makeCrudHooks`; on top
 * of that, `useUploadMedia` runs the declared-upload flow (`upload.ts`)
 * and then creates the `MediaAsset` that links to the new file, so a
 * caller gets one mutation that goes from a `File` to a ready row.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminCreate, adminGet } from "../admin-shared/crud";
import { makeCrudHooks } from "../admin-shared/hooks";
import { uploadImage } from "./upload";
import type { MediaAssetRow } from "./types";

export const media = makeCrudHooks<MediaAssetRow, Record<string, unknown>>("media", "/admin/media/");

/** A single asset by id — for `MediaPicker` to show the current pick. */
export function useMediaAsset(id: number | null) {
  return useQuery<MediaAssetRow>({
    queryKey: ["admin", "media", "detail", id],
    queryFn: () => adminGet<MediaAssetRow>("/admin/media/", id!),
    enabled: id != null,
  });
}

export interface UploadMediaInput {
  file: File;
  alt_text: string;
  caption?: string;
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation<MediaAssetRow, unknown, UploadMediaInput>({
    mutationFn: async ({ file, alt_text, caption = "" }) => {
      const doc = await uploadImage(file);
      return adminCreate<MediaAssetRow>("/admin/media/", {
        document: doc.id,
        alt_text,
        caption,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "media"] }),
  });
}
