# UI Fix Merge Guard

Use this when merging other branches after `slimd-fix-ui`. These changes should be preserved.

Protected commits:
- `049445d Fix responsive UI annotations`
- `98f32f5 Refine product listing annotations`

## Home `/vi` fixes

Files:
- `src/components/sections/hero.tsx`
- `src/components/sections/instagram.tsx`
- `src/components/sections/products-grid.tsx`
- `src/components/sections/about.tsx`
- `src/components/sections/rooms.tsx`
- `src/components/sections/brands.tsx`
- `src/components/sections/featured-products.tsx`
- `src/components/sections/footer.tsx`
- `src/components/header.tsx`

Expected preserved behavior:
- Mobile hero is shorter, approximately 3:2.
- Hero carousel arrows are hidden on phone.
- Instagram carousel shows one card on phone, has dot indicators, and hides arrows on phone.
- Instagram mobile shell has strong horizontal padding: `!px-24 lg:!px-0`.
- Product section on home is a mobile carousel with dot indicators; desktop remains grid.
- Room section is a mobile carousel with dot indicators; desktop remains 2-column grid.
- About divider is horizontal on mobile and vertical on desktop.
- About image has no rounded mobile container/padding regression; dots stay on image.
- Featured-products section is a mobile carousel with two stacked rows per slide; desktop layout preserved.
- Brand section title stays fixed; only logo marquee scrolls.
- Footer Showrooms and Contacts each take full width in the 2-column mobile footer grid, not split into two side-by-side columns.
- Site header content uses `site-shell` max width and aligns with sections on all pages.

## Product detail fixes

Files:
- `src/app/[locale]/products/[slug]/page.tsx`
- `src/components/product-detail/section-1-hero.tsx`
- `src/components/product-detail/section-4-gallery.tsx`
- `src/components/product-detail/section-5-benefits.tsx`
- `src/lib/queries/products.ts`

Expected preserved behavior:
- Related products fetch same/similar category products from Supabase, exclude current variant, and show up to 8 products.
- Related product cards use packshot images, not lifestyle images.
- Product gallery uses lifestyle/long/closeup/gallery images and has no rounded image corners.
- Product hero brand uses the product brand logo when available.
- Favorite CTA in product hero is square with heart icon.
- Benefits section becomes 2x2 on iPad/tablet and 4 columns on large desktop.

## Products listing `/vi/products` fixes

Files:
- `src/app/[locale]/products/page.tsx`
- `src/components/products/ProductGrid.tsx`
- `src/components/products/product-card.tsx`
- `src/components/products/catalog-header.tsx`
- `src/components/header.tsx`
- `src/components/shared/shared-header.tsx`
- `src/lib/queries/products.ts`

Expected preserved behavior:
- Product grid color swatch bar is removed.
- Product image is below tag/heart, bottom-aligned, with enough top/bottom spacing.
- Status tag and heart are close to top corners.
- Heart has no circle/box, is slightly smaller/lighter, and uses `strokeWidth={1.5}`.
- Brand renders as logo when available.
- Product text block has small side margin like the tag: `mx-1 sm:mx-1.5`.
- Product title is 2-line clamped, smaller on mobile, and normal weight.
- Subtitle uses formatted sub-category text, e.g. `Table Lamps`, not raw `table-lamps`.
- Nav/category/header text is normal weight, not bold.
- Product status badge colors are light background variants, not solid red/green.

## Quick diff check after later merges

Run this after merging other branches:

```bash
git diff 98f32f5 -- \
  src/app/[locale]/products/page.tsx \
  src/app/[locale]/products/[slug]/page.tsx \
  src/components/header.tsx \
  src/components/shared/shared-header.tsx \
  src/components/products/ProductGrid.tsx \
  src/components/products/product-card.tsx \
  src/components/products/catalog-header.tsx \
  src/components/product-detail/section-1-hero.tsx \
  src/components/product-detail/section-4-gallery.tsx \
  src/components/product-detail/section-5-benefits.tsx \
  src/components/sections/hero.tsx \
  src/components/sections/instagram.tsx \
  src/components/sections/products-grid.tsx \
  src/components/sections/about.tsx \
  src/components/sections/rooms.tsx \
  src/components/sections/brands.tsx \
  src/components/sections/featured-products.tsx \
  src/components/sections/footer.tsx \
  src/lib/queries/products.ts
```

If the diff shows another branch changed one of these protected behaviors, restore the desired version from `slimd-fix-ui` or cherry-pick the protected commit again.

```bash
git checkout slimd-fix-ui -- <file>
git add <file>
```

Then manually review to keep any unrelated intentional changes from the other branch.
