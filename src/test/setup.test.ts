import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";

describe("vitest setup", () => {
  it("loads jest-dom matchers into expect via RTL render", () => {
    render(createElement("div", { "data-testid": "node" }, "hello world"));
    // toBeInTheDocument / toHaveTextContent come from @testing-library/jest-dom,
    // imported by src/test/setup.ts. Without setup.ts loaded these matchers are
    // unavailable and the test throws "Invalid Chai property: toBeInTheDocument".
    expect(screen.getByTestId("node")).toBeInTheDocument();
    expect(screen.getByTestId("node")).toHaveTextContent("hello world");
  });

  it("cleans up RTL-rendered nodes between tests via setup.ts afterEach cleanup", () => {
    // render() in the previous test appends a container to document.body.
    // setup.ts registers afterEach(cleanup) from @testing-library/react, which
    // unmounts that container. If cleanup did NOT run, body.firstChild would
    // still be the RTL container and this assertion would fail.
    expect(document.body.firstChild).toBeNull();
  });
});