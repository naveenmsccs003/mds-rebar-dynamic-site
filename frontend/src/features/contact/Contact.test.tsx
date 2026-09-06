import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../../api/request";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { ContactPage } from "./ContactPage";

vi.mock("./api");
const submitEnquiry = vi.mocked(api.submitEnquiry);
afterEach(() => vi.resetAllMocks());

function render() {
  return renderWithProviders(<ContactPage />, { route: "/contact" });
}

describe("ContactPage", () => {
  it("validates required fields before calling the API", async () => {
    render();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Send message/i }));

    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter a message.")).toBeInTheDocument();
    expect(submitEnquiry).not.toHaveBeenCalled();
  });

  it("submits and shows the reference on success", async () => {
    submitEnquiry.mockResolvedValue({ reference: "MDS-E-2026-000004", status: "new" });
    render();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Full name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Message"), "Please call me.");
    await user.click(screen.getByLabelText(/Business \/ partnership/i));
    await user.click(screen.getByRole("button", { name: /Send message/i }));

    expect(await screen.findByText(/Message received/i)).toBeInTheDocument();
    expect(screen.getByText("MDS-E-2026-000004")).toBeInTheDocument();
    expect(submitEnquiry.mock.calls[0][0]).toEqual(
      expect.objectContaining({ enquiry_type: "business", name: "Jane Doe", message: "Please call me." }),
    );
  });

  it("maps a server field error back onto the input", async () => {
    submitEnquiry.mockRejectedValue(
      new ApiRequestError("Validation failed.", "VALIDATION_ERROR", {
        email: ["Enter a valid email address."],
      }),
    );
    render();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Full name"), "Jane");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Message"), "hi");
    await user.click(screen.getByRole("button", { name: /Send message/i }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("does nothing when the honeypot is filled", async () => {
    render();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full name"), "Bot");
    await user.type(screen.getByLabelText("Email"), "bot@example.com");
    await user.type(screen.getByLabelText("Message"), "spam");
    fireEvent.change(document.querySelector('input[name="website"]')!, { target: { value: "x" } });
    await user.click(screen.getByRole("button", { name: /Send message/i }));

    expect(submitEnquiry).not.toHaveBeenCalled();
  });
});
