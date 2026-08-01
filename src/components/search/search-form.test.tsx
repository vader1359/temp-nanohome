import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SearchForm } from "./search-form";

describe("SearchForm", () => {
  it("preserves the query through native GET navigation", () => {
    render(
      <SearchForm
        locale="vi"
        defaultValue=""
        placeholder="Search"
        submitText="Submit"
        labelText="Site search"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Site search" });
    const form = input.closest("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Search form was not rendered");
    }

    expect(form).toHaveAttribute("action", "/vi/search");
    expect(form).toHaveAttribute("method", "get");
    expect(input).toHaveAttribute("name", "q");
  });
});
