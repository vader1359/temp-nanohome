import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PreferenceFeature, RecentEntity } from "@/lib/personalization";
import { PreferenceCenter } from "./preference-center";
import { RecentlyViewedList } from "./recently-viewed-list";
import { RecommendationRail } from "./recommendation-rail";

const preferences: readonly PreferenceFeature[] = [
  { key: "material", value: "linen", labelKey: "preference_linen" },
];
const recent: readonly RecentEntity[] = [{ entityType: "variant", entityId: "linen-chair" }];

describe("personalization components", () => {
  it("Given consent is absent, When the preference center renders, Then it shows a curated notice without controls", () => {
    render(<PreferenceCenter consent={false} preferences={preferences} onEdit={vi.fn()} onReset={vi.fn()} onDisable={vi.fn()} />);

    expect(screen.getByText("A considered selection for your home")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("Given consent is granted, When a preference is edited, Then the edit callback receives the feature", () => {
    const onEdit = vi.fn();
    render(<PreferenceCenter consent preferences={preferences} onEdit={onEdit} onReset={vi.fn()} onDisable={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit linen preference" }));

    expect(onEdit).toHaveBeenCalledWith(preferences[0]);
  });

  it("Given personalization is disabled, When consent is present, Then curated copy hides controls", () => {
    render(<PreferenceCenter enabled={false} consent preferences={preferences} onEdit={vi.fn()} onReset={vi.fn()} onDisable={vi.fn()} onDisconnectMemory={vi.fn()} />);

    expect(screen.getByText("A considered selection for your home")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("Given customer memory is connected, When disconnect is clicked, Then only the memory disconnect callback runs", () => {
    const onDisconnectMemory = vi.fn();
    render(<PreferenceCenter enabled consent preferences={preferences} onEdit={vi.fn()} onReset={vi.fn()} onDisable={vi.fn()} onDisconnectMemory={onDisconnectMemory} />);

    fireEvent.click(screen.getByRole("button", { name: "Disconnect customer memory" }));

    expect(onDisconnectMemory).toHaveBeenCalledOnce();
  });

  it("Given consent is granted, When a recent item is removed, Then the remove callback receives its entity", () => {
    const onRemove = vi.fn();
    render(<RecentlyViewedList consent recent={recent} labels={{ "variant:linen-chair": "Linen chair" }} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Linen chair from recently viewed" }));

    expect(onRemove).toHaveBeenCalledWith(recent[0]);
  });

  it("Given consent is absent, When recent items render, Then no remove control is offered", () => {
    render(<RecentlyViewedList consent={false} recent={recent} labels={{ "variant:linen-chair": "Linen chair" }} onRemove={vi.fn()} />);

    expect(screen.getByText("Recently viewed, kept simple")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("Given recently viewed is disabled, When recent items render, Then curated copy hides removal", () => {
    render(<RecentlyViewedList enabled={false} consent recent={recent} labels={{ "variant:linen-chair": "Linen chair" }} onRemove={vi.fn()} />);

    expect(screen.getByText("A curated edit is here when you would like a fresh perspective.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("Given approved explanation labels, When recommendations render, Then they are shown with an exclude control", () => {
    const onExclude = vi.fn();
    render(<RecommendationRail consent recommendations={[{ id: "oak-table", title: "Oak table", explanationKey: "curated_default" }]} explanationLabels={{ curated_default: "A calm starting point" }} onExclude={onExclude} />);

    expect(screen.getByText("A calm starting point")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Exclude Oak table" }));
    expect(onExclude).toHaveBeenCalledWith("oak-table");
  });

  it("Given an unknown explanation key, When recommendations render, Then curated explanation is shown", () => {
    render(<RecommendationRail consent recommendations={[{ id: "oak-table", title: "Oak table", explanationKey: "private_memory" }]} explanationLabels={{ curated_default: "A calm starting point" }} onExclude={vi.fn()} />);

    expect(screen.getByText("A calm starting point")).toBeVisible();
    expect(screen.queryByText("private_memory")).not.toBeInTheDocument();
  });
});
