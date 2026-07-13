import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getBrands: vi.fn(async () => []),
  getCatalogs: vi.fn(async () => [
    {
      brand_name: "HAY",
      cloudinary_ids: [],
      cloudinary_urls: [],
      file_urls: [
        "https://res.cloudinary.com/iant1359/hay-main.pdf",
        "https://res.cloudinary.com/iant1359/hay-lighting.pdf",
      ],
      id: "hay-catalog",
      origin: "Denmark",
      origin_ko: null,
      origin_vi: null,
    },
  ]),
}));

vi.mock("@/components/catalogs/catalog-group", () => ({
  CatalogGroup: ({ cards }: { readonly cards: readonly { readonly url: string }[] }) => <>{cards.map((card) => <a key={card.url} href={card.url} />)}</>,
}));
vi.mock("@/components/editorial/shared", () => ({
  EditorialHeader: () => null,
  textValue: (value: string | null, fallback: string) => value ?? fallback,
}));
vi.mock("@/lib/queries/catalog-url", () => ({ catalogFileUrl: (value: string) => value }));
vi.mock("@/lib/queries/brands", () => ({ getBrands: state.getBrands }));
vi.mock("@/lib/queries/catalogs", () => ({ getCatalogs: state.getCatalogs }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
  setRequestLocale: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import CatalogsPage from "./page";

function catalogLinks(node: React.ReactNode): readonly React.ReactElement[] {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return [];
  if (Array.isArray(node)) return node.flatMap(catalogLinks);

  const element = node as React.ReactElement<{ readonly children?: React.ReactNode; readonly href?: string; readonly cards?: readonly { readonly url: string }[] }>;
  const cardLinks = element.props.cards?.map((card) => <a key={card.url} href={card.url} />) ?? [];
  const children = catalogLinks(element.props.children);
  return element.props.href?.includes("res.cloudinary.com") ? [element, ...cardLinks, ...children] : [...cardLinks, ...children];
}

describe("catalogs page", () => {
  it("renders a letter-size card link for every validated PDF in a brand section", async () => {
    // Given a brand with multiple approved catalog PDFs.
    // When the catalogs route renders its brand section.
    const page = await CatalogsPage({ params: Promise.resolve({ locale: "vi" }) });

    // Then every PDF receives its own accessible catalog link.
    expect(catalogLinks(page).map((link) => link.props.href)).toEqual([
      "https://res.cloudinary.com/iant1359/hay-main.pdf",
      "https://res.cloudinary.com/iant1359/hay-lighting.pdf",
    ]);
  });
});
