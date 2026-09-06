import { useMutation } from "@tanstack/react-query";

import { submitQuoteRequest } from "./api";
import type { QuoteInput, QuoteResult } from "./types";

export function useQuoteSubmit() {
  return useMutation<QuoteResult, unknown, QuoteInput>({ mutationFn: submitQuoteRequest });
}
