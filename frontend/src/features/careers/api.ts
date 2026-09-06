import type { Paginated } from "../../api/envelope";
import { apiGet, apiPostForm } from "../../api/request";
import type { ApplicationInput, ApplicationResult, JobPostingDetail, JobPostingListItem } from "./types";

export function getJobPostings(
  params: Record<string, string> = {},
): Promise<Paginated<JobPostingListItem>> {
  return apiGet<Paginated<JobPostingListItem>>("/careers/", params);
}

export function getJobPosting(slug: string): Promise<JobPostingDetail> {
  return apiGet<JobPostingDetail>(`/careers/${encodeURIComponent(slug)}/`);
}

export function submitApplication(input: ApplicationInput): Promise<ApplicationResult> {
  const form = new FormData();
  form.append("job", input.job);
  form.append("name", input.name);
  form.append("email", input.email);
  form.append("phone", input.phone);
  form.append("cover_letter", input.cover_letter);
  form.append("resume", input.resume);
  // A fresh key per submission attempt makes a retry after a network
  // error safe — the server returns the original result on replay
  // (docs/API_DESIGN.md "Idempotency").
  const idempotencyKey = crypto.randomUUID();
  return apiPostForm<ApplicationResult>("/career-applications/", form, {
    "Idempotency-Key": idempotencyKey,
  });
}
