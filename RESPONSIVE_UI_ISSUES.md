# Responsive UI handoff

Audit date: 2026-06-29

Pages tested:

- `/vi`
- `/vi/products`
- `/vi/products/ghe-palissade-ottoman-b%E1%BA%B1ng-thep-xam-tr%E1%BA%AFng-sky-grey`

Viewports tested: `375x812`, `768x1024`, and `1440x900`.

## Required fixes

### P0: Product detail is broken on mobile

At `375x812`, the breadcrumb, main product image, product title, and variant text extend beyond the right edge and are clipped. The global horizontal clipping prevents the user from reaching the hidden content. Some gallery thumbnails also render as broken images.

Expected:

- No content extends past the viewport at 360-375px widths.
- Breadcrumb wraps or truncates intentionally without hiding the current product context.
- Main image fits the available content width and preserves a useful crop/aspect ratio.
- Product title and variant text wrap inside the viewport.
- Broken or unavailable gallery images have a valid fallback and do not show the browser broken-image state.

### P1: Products filters bury the product grid on mobile and tablet

The first product begins around `y=1699px` at 375px and `y=1493px` at 768px because every filter group is expanded before the grid.

Expected:

- Mobile and tablet expose filters through a compact control (drawer, bottom sheet, or collapsed accordion).
- Product results should be visible near the initial viewport after the page heading/sort controls.
- Desktop keeps the useful sidebar layout.
- Active filter count and applied filters remain discoverable.

### P1: Homepage hero/header content is clipped on mobile

At `375x812`, the header logo is partially clipped and the hero heading extends beyond the right edge. Carousel controls also sit too close to the edges.

Expected:

- Logo, hero copy, CTA, and slider controls fit within 360-375px viewports.
- Hero heading wraps naturally with no hidden words.
- Maintain the existing desktop composition at 1440px.

### P1: Product detail lacks site navigation

Product detail does not show the standard site header on mobile, tablet, or desktop, unlike Homepage and Products.

Expected:

- Provide consistent navigation/header behavior on product detail.
- Avoid duplicate headers if the route already receives one through a layout.

### P2: Interactive hit areas are too small

Observed hit areas include 20px header icons, a 32px hamburger, 24px hero arrows, 32px wishlist buttons, 36px gallery controls, and product-detail tabs with roughly 18px height.

Expected:

- Important touch controls should have an effective hit area close to at least `44x44px` while preserving their visual icon size.
- Filter rows and locale controls should be comfortably tappable.

### P2: Excessive mobile page length and unclear horizontal affordance

Homepage is approximately 13,150px tall at mobile width because large product/room sections become a single long column. The brands strip scrolls horizontally (about 1,209px of content in a 360px region) without a clear affordance.

Expected:

- Reduce unnecessary mobile scrolling where it does not harm discovery (for example, horizontal cards or fewer initial items plus `Xem thêm`).
- Make horizontal brand scrolling visually discoverable, or use a wrapping/controlled carousel treatment.

## Implementation constraints

- Preserve all existing user changes in this dirty worktree.
- Before editing Next.js code, read the relevant guide under `node_modules/next/dist/docs/` as required by `AGENTS.md`.
- Prefer responsive CSS/layout fixes over hiding content.
- Do not treat `overflow-x: clip` as the fix for content that exceeds the viewport.
- Keep current desktop behavior unless a change is necessary for consistency.

## Verification checklist

- Test all three pages at `375x812`, `768x1024`, and `1440x900`.
- Confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and also visually confirm no content is clipped.
- Verify header/menu, filters, gallery thumbnails, product title, variant selection, wishlist, carousel arrows, and relevant CTAs.
- Run the relevant lint/type/test commands and report any pre-existing failures separately.
