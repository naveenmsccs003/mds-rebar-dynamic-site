import { apiPost } from "../../api/request";
import type { EnquiryInput, EnquiryResult } from "./types";

export function submitEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  return apiPost<EnquiryResult>("/contact/", input);
}
