import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichText } from "./RichText";

describe("RichText", () => {
  it("keeps allow-listed formatting", () => {
    const { container } = render(
      <RichText html="<h2>Title</h2><p>a <strong>b</strong></p><ul><li>x</li></ul>" />,
    );
    expect(container.querySelector("h2")).toHaveTextContent("Title");
    expect(container.querySelector("strong")).toHaveTextContent("b");
    expect(container.querySelector("li")).toHaveTextContent("x");
  });

  it("strips scripts, iframes and event handlers even if the server missed them", () => {
    const { container } = render(
      <RichText html='<p onclick="x()">hi</p><script>evil()</script><iframe src="x"></iframe>' />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("onclick");
    expect(container.querySelector("p")).toHaveTextContent("hi");
  });

  it("drops inline styles", () => {
    const { container } = render(<RichText html='<p style="position:fixed">x</p>' />);
    expect(container.querySelector("p")?.getAttribute("style")).toBeNull();
  });

  it("renders nothing meaningful for empty input", () => {
    const { container } = render(<RichText html="" />);
    expect(container.querySelector(".rich-text")?.innerHTML).toBe("");
  });
});
