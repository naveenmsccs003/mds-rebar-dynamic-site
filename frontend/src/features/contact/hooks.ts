import { useMutation } from "@tanstack/react-query";

import { submitEnquiry } from "./api";
import type { EnquiryInput, EnquiryResult } from "./types";

export function useEnquirySubmit() {
  return useMutation<EnquiryResult, unknown, EnquiryInput>({ mutationFn: submitEnquiry });
}
