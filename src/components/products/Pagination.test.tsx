import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("returns to the top when changing page", () => {
    const setCurrentPage = vi.fn();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    render(<Pagination currentPage={1} pageSize={24} setCurrentPage={setCurrentPage} totalCount={48} />);

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(setCurrentPage).toHaveBeenCalledWith(2);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    scrollTo.mockRestore();
  });
});
