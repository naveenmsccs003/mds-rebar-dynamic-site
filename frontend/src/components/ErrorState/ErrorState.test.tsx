import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("shows the message and invokes onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load services." onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Could not load services.");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry button when no onRetry handler is given", () => {
    render(<ErrorState message="Failed." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
