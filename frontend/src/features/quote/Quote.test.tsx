import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders";
import * as servicesApi from "../services/api";
import * as api from "./api";
import { RequestQuotePage } from "./RequestQuotePage";

vi.mock("./api");
vi.mock("../services/api");
const submitQuoteRequest = vi.mocked(api.submitQuoteRequest);
const getServices = vi.mocked(servicesApi.getServices);
afterEach(() => vi.resetAllMocks());

function render() {
  getServices.mockResolvedValue([
    {
      id: 1,
      name: "Rebar Detailing",
      slug: "rebar-detailing",
      short_description: "",
      hero_image: null,
      icon: null,
      display_order: 0,
    },
  ]);
  return renderWithProviders(<RequestQuotePage />, { route: "/request-quote" });
}

describe("RequestQuotePage", () => {
  it("requires name and a valid email", async () => {
    render();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Request quote/i }));

    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(submitQuoteRequest).not.toHaveBeenCalled();
  });

  it("submits with the chosen service slug and shows the reference", async () => {
    submitQuoteRequest.mockResolvedValue({ reference: "MDS-Q-2026-000007", status: "new" });
    render();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Full name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    expect(await screen.findByRole("option", { name: "Rebar Detailing" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Service/), "rebar-detailing");
    await user.type(screen.getByLabelText(/Project type/), "Bridge");
    await user.click(screen.getByRole("button", { name: /Request quote/i }));

    expect(await screen.findByText(/Quote request received/i)).toBeInTheDocument();
    expect(screen.getByText("MDS-Q-2026-000007")).toBeInTheDocument();
    expect(submitQuoteRequest.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "Jane Doe", service: "rebar-detailing", project_type: "Bridge" }),
    );
  });

  it("sends service as null when left unselected", async () => {
    submitQuoteRequest.mockResolvedValue({ reference: "MDS-Q-2026-000008", status: "new" });
    render();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Full name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.click(screen.getByRole("button", { name: /Request quote/i }));

    expect(await screen.findByText(/Quote request received/i)).toBeInTheDocument();
    expect(submitQuoteRequest.mock.calls[0][0]).toEqual(expect.objectContaining({ service: null }));
  });
});
