import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountOfferList } from "./account-offer-list";

const offer = { title: "Mùa hè", code: "SUMMER", validFrom: "2026-06-01", validUntil: "2026-08-31", eligibleScope: "Danh mục ghế", minimumAmount: { amount: 1000000, currency: "VND" }, combinationRule: "Không cộng dồn", remainingUses: 2, status: "active" } as const;

describe("AccountOfferList", () => {
  it("renders public offer terms in an accessible card", () => {
    // Given: one account-owned offer.
    render(<AccountOfferList offers={[offer]} />);
    // When: the offers surface is displayed.
    // Then: public terms and status are visible without private audience data.
    expect(screen.getByRole("heading", { name: "Mùa hè" })).toBeInTheDocument();
    expect(screen.getByText("SUMMER")).toBeInTheDocument();
    expect(screen.getByText("Còn 2 lượt sử dụng")).toBeInTheDocument();
    expect(screen.queryByText(/audience|segment|CRM/i)).not.toBeInTheDocument();
  });

  it("renders a neutral empty state", () => {
    // Given: no account-owned offers.
    render(<AccountOfferList offers={[]} />);
    // When: the offers surface is displayed.
    // Then: it gives no diagnostic explanation.
    expect(screen.getByText("Hiện chưa có ưu đãi dành cho bạn.")).toBeInTheDocument();
  });
});
