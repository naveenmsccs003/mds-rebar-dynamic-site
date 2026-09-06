import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import { getJobPosting, getJobPostings, submitApplication } from "./api";
import type { ApplicationInput, ApplicationResult, JobPostingDetail, JobPostingListItem } from "./types";

export function useJobPostings(params: Record<string, string>) {
  return useQuery<Paginated<JobPostingListItem>>({
    queryKey: ["careers", "list", params],
    queryFn: () => getJobPostings(params),
    placeholderData: keepPreviousData,
  });
}

export function useJobPosting(slug: string) {
  return useQuery<JobPostingDetail>({
    queryKey: ["careers", "detail", slug],
    queryFn: () => getJobPosting(slug),
  });
}

export function useApplicationSubmit() {
  return useMutation<ApplicationResult, unknown, ApplicationInput>({
    mutationFn: submitApplication,
  });
}
