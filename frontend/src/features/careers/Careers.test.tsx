import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "../../api/envelope";
import { ApiRequestError } from "../../api/request";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { CareersListPage } from "./CareersListPage";
import { JobDetailTemplate } from "./JobDetailTemplate";
import type { JobPostingDetail, JobPostingListItem } from "./types";

vi.mock("./api");
const getJobPostings = vi.mocked(api.getJobPostings);
const getJobPosting = vi.mocked(api.getJobPosting);
const submitApplication = vi.mocked(api.submitApplication);
afterEach(() => vi.resetAllMocks());

const listItem = (o: Partial<JobPostingListItem> = {}): JobPostingListItem => ({
  id: 1,
  title: "Rebar Detailer",
  slug: "rebar-detailer",
  department: "Detailing",
  location: "Dubai",
  employment_type: "full_time",
  experience: "3-5 years",
  application_deadline: null,
  is_open: true,
  created_at: "2026-09-01T00:00:00Z",
  ...o,
});

const detail = (o: Partial<JobPostingDetail> = {}): JobPostingDetail => ({
  ...listItem(),
  skills: "AutoCAD, aSa",
  skills_list: ["AutoCAD", "aSa"],
  description: "Detail reinforcement drawings.",
  responsibilities: "",
  requirements: "",
  benefits: "",
  updated_at: "2026-09-01T00:00:00Z",
  ...o,
});

function renderDetail(slug: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/careers/:slug" element={<JobDetailTemplate />} />
    </Routes>,
    { route: `/careers/${slug}` },
  );
}

describe("CareersListPage", () => {
  it("lists open positions with links under /careers", async () => {
    getJobPostings.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [listItem()],
    } satisfies Paginated<JobPostingListItem>);

    renderWithProviders(<CareersListPage />, { route: "/careers" });

    expect(await screen.findByRole("link", { name: /Rebar Detailer/ })).toHaveAttribute(
      "href",
      "/careers/rebar-detailer",
    );
    await waitFor(() => expect(document.title).toBe("Careers — MDS Rebar"));
  });

  it("shows the empty state when nothing is open", async () => {
    getJobPostings.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    renderWithProviders(<CareersListPage />, { route: "/careers" });
    expect(await screen.findByText(/No open positions right now/i)).toBeInTheDocument();
  });
});

describe("JobDetailTemplate", () => {
  it("renders the posting and the application form", async () => {
    getJobPosting.mockResolvedValue(detail());
    renderDetail("rebar-detailer");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Rebar Detailer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Detail reinforcement drawings.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Apply for this role/i })).toBeInTheDocument();
  });

  it("renders 404 for a missing posting", async () => {
    getJobPosting.mockRejectedValue(new ApiRequestError("gone", "NOT_FOUND", {}, 404));
    renderDetail("ghost");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("hides the form for a closed posting", async () => {
    getJobPosting.mockResolvedValue(detail({ is_open: false }));
    renderDetail("rebar-detailer");
    expect(
      await screen.findByText(/no longer accepting applications/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit application/i })).not.toBeInTheDocument();
  });
});

describe("ApplicationForm", () => {
  const file = () => new File(["%PDF-1.4 body"], "cv.pdf", { type: "application/pdf" });

  it("blocks submission and shows field errors when required fields are missing", async () => {
    getJobPosting.mockResolvedValue(detail());
    renderDetail("rebar-detailer");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Submit application/i }));

    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Attach your résumé.")).toBeInTheDocument();
    expect(submitApplication).not.toHaveBeenCalled();
  });

  it("rejects a non-document résumé before hitting the network", async () => {
    getJobPosting.mockResolvedValue(detail());
    renderDetail("rebar-detailer");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Full name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    // Bypass the input's `accept` filter (a drag-drop or a crafted client
    // can) to exercise the JS extension check, not just the browser's.
    fireEvent.change(screen.getByLabelText(/Résumé/), {
      target: { files: [new File(["nope"], "cv.exe", { type: "application/octet-stream" })] },
    });
    await user.click(screen.getByRole("button", { name: /Submit application/i }));

    expect(await screen.findByText(/must be a PDF or Word document/i)).toBeInTheDocument();
    expect(submitApplication).not.toHaveBeenCalled();
  });

  it("submits a valid application and shows the confirmation with the reference", async () => {
    getJobPosting.mockResolvedValue(detail());
    submitApplication.mockResolvedValue({ reference: "abc-123", status: "new" });
    renderDetail("rebar-detailer");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Full name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.upload(screen.getByLabelText(/Résumé/), file());
    await user.click(screen.getByRole("button", { name: /Submit application/i }));

    expect(await screen.findByText(/Application received/i)).toBeInTheDocument();
    expect(screen.getByText("abc-123")).toBeInTheDocument();
    expect(submitApplication.mock.calls[0][0]).toEqual(
      expect.objectContaining({ job: "rebar-detailer", name: "Jane Doe", email: "jane@example.com" }),
    );
  });

  it("surfaces a server-side field error on the résumé", async () => {
    getJobPosting.mockResolvedValue(detail());
    submitApplication.mockRejectedValue(
      new ApiRequestError("Validation failed.", "VALIDATION_ERROR", {
        resume: ["The file content does not match its extension."],
      }),
    );
    renderDetail("rebar-detailer");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Full name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.upload(screen.getByLabelText(/Résumé/), file());
    await user.click(screen.getByRole("button", { name: /Submit application/i }));

    expect(
      await screen.findByText(/file content does not match its extension/i),
    ).toBeInTheDocument();
  });

  it("does nothing when the honeypot is filled", async () => {
    getJobPosting.mockResolvedValue(detail());
    renderDetail("rebar-detailer");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Full name"), "Bot");
    await user.type(screen.getByLabelText("Email"), "bot@example.com");
    await user.upload(screen.getByLabelText(/Résumé/), file());
    // The honeypot input is aria-hidden; set it directly.
    fireEvent.change(document.querySelector('input[name="website"]')!, {
      target: { value: "http://spam.example" },
    });
    await user.click(screen.getByRole("button", { name: /Submit application/i }));

    await waitFor(() => expect(submitApplication).not.toHaveBeenCalled());
  });
});
