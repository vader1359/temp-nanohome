# NanoHome Design System

## 1. Atmosphere & Identity

NanoHome feels like a quiet premium interiors gallery: warm, editorial, precise, and spacious. The signature is restrained warmth — off-white surfaces, thin stone-like dividers, generous white space, and product imagery treated as the hero rather than decoration.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--nh-surface-primary` | `#FFFFFF` | `#111111` | Cards, image wells, neutral sections |
| Surface/warm | `--nh-surface-warm` | `#FAF9F8` | `#171411` | Page backgrounds from Figma `background/b-2` |
| Surface/muted | `--nh-surface-muted` | `#E1E1E1` | `#2A2927` | Brand logo tiles, quiet placeholders |
| Text/primary | `--nh-ink` | `#111111` | `#FAF9F8` | Headlines, body, navigation |
| Text/secondary | `--nh-muted` | `#666666` | `#B5AFA7` | Meta text, captions, secondary copy |
| Border/default | `--nh-border` | `#CFC9C0` | `#4A443D` | Dividers, section rules, column separators |
| Accent/primary | `--nh-accent` | `#5D3E16` | `#C9A06A` | Text links, subtle active states |
| Icon/default | `--nh-icon-gray` | `#7B7770` | `#B6B0A8` | Utility icons |
| Status/success | `--nh-green` | `#00A63E` | `#36D06C` | Availability |
| Status/error | `--nh-red` | `#930000` | `#E45B5B` | Sale/error labels |

### Rules

- Use `#FAF9F8` as the default background for editorial pages: about, news, catalogs, designers, brands.
- Use thin borders and tonal shifts instead of heavy shadows.
- Accent is quiet and functional. Product imagery and logos provide visual weight.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `40px` desktop / `32px` mobile | 500 | `1.2` | `0` | Large editorial page titles |
| H1 | `32px` | 500 | `40px` | `0` | Figma page headings |
| H2 | `24px` | 500 | `32px` | `0` | Section titles, feature card titles |
| H3 | `18px` | 500 | `28px` | `0` | Card titles |
| Body/lg | `24px` | 400 | `32px` | `0` | About lead copy |
| Body | `14px` | 400 | `22px` | `0` | Main copy from Figma |
| Body/sm | `12px` | 400 | `18px` | `0` | Metadata |
| Overline | `14px` | 500 | `20px` | `0.08em` | Uppercase eyebrows/category labels |

### Font Stack

- Primary: `Libre Franklin, system-ui, -apple-system, BlinkMacSystemFont, sans-serif`.
- Mono: `Geist Mono, ui-monospace, SFMono-Regular, monospace`.
- Figma references `PicareskVN` for overline labels; use uppercase Libre Franklin when that font is unavailable.

### Rules

- Body text never below `12px` for metadata and never below `14px` for prose.
- Long Vietnamese headings use `clamp()` or responsive utilities to avoid four-line desktop wraps.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of **4px**.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Tight inline gaps |
| `--space-2` | `8px` | Metadata gaps |
| `--space-3` | `12px` | Compact card padding |
| `--space-4` | `16px` | Mobile card gaps |
| `--space-5` | `20px` | Comfortable inner padding |
| `--space-6` | `24px` | Desktop gutters, card gaps |
| `--space-8` | `32px` | Card-to-copy gaps |
| `--space-10` | `40px` | Section internals |
| `--space-12` | `48px` | Figma hero heading gap |
| `--space-15` | `60px` | Desktop grid row gap, top page groups |
| `--space-16` | `64px` | Page rhythm |
| `--space-20` | `80px` | Large section breaks |
| `--space-24` | `96px` | Maximum editorial separation |

### Grid

- Max content width: `1344px` for Figma desktop pages, with `48px` desktop side gutters.
- Standard desktop column grid: 12 columns, `24px` gutters.
- Listing card grid: 3 columns at desktop, 2 at tablet, 1 at mobile.
- Designer grid target: `204px` cards with `24px` column gap and `60px` row gap.
- Breakpoints: Tailwind defaults: `sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1536px`.

### Rules

- Use `.site-shell` for shared horizontal rhythm unless a Figma section requires full-bleed width.
- Section top after header starts around `80px` mobile and `80px` desktop because global header already owns the first `80/150px`.

## 5. Components

### Editorial Header

- **Structure**: centered eyebrow, heading, optional intro paragraph.
- **Spacing**: `60px` top group, `48px` title gap where Figma specifies.
- **States**: static.
- **Accessibility**: one page-level `h1`.
- **Motion**: none by default.

### Content Card

- **Structure**: image well, metadata row, title, optional excerpt.
- **Variants**: feature, compact, standard grid.
- **Spacing**: `24px` desktop gap, `16px` mobile gap.
- **States**: hover image scale via `transform`, focus ring on links.
- **Accessibility**: descriptive `alt`, full-card link has visible title text.
- **Motion**: `300ms ease-in-out`, transform/opacity only.

### Logo Tile

- **Structure**: warm/muted rectangular tile with centered logo or text fallback.
- **Variants**: brand grid, catalog brand section.
- **Spacing**: `204px x 160px` desktop target, responsive fluid columns.
- **States**: hover tonal shift, focus ring.
- **Accessibility**: brand name text/alt.
- **Motion**: subtle opacity/transform only.

### Detail Article

- **Structure**: centered title/meta, hero media, prose/Notion body, related products where available.
- **Spacing**: `64px` between major blocks.
- **States**: fallback description when Notion content is unavailable.
- **Accessibility**: semantic `article`, `time` when date exists.
- **Motion**: none.

### Auth Panel

- **Structure**: dimmed homepage backdrop with a right-aligned white account panel. Desktop target width is `392px`; below tablet the panel occupies the full viewport width.
- **Spacing**: `32px` side padding on desktop, `24px` on mobile; form controls follow the 4px spacing scale with `24px` field rhythm.
- **Typography**: `H2` title, body subtitle, uppercase `Overline` action links and primary buttons.
- **Controls**: underline inputs use `--nh-border` by default, `--nh-red` for validation and server errors, and `--nh-accent` for secondary text actions. Primary actions reuse the black editorial CTA style.
- **States**: login, register, forgot password, reset password, loading, validation, generic server error, sent, expired, and success.
- **Accessibility**: modal dialog semantics, labelled close control, focus return to trigger, keyboard escape close, and no server error copy that reveals whether email or password failed.
- **Motion**: backdrop opacity and panel transform only, `300ms ease-in-out`, with reduced-motion support.

### Global Navigation

- **Reference contract**: a crisp white editorial surface with low-contrast `rgba(17, 17, 17, 0.14)` separators, `#111111` primary ink, `#444444` secondary ink, and restrained warm-brown active states near `#5F5954`.
- **Structure**: desktop uses a compact meta row above the primary category row; the wordmark remains centered while utility controls sit at the outer edge. The desktop header remains within the existing `150px` site allocation, with a `~79px` visual primary navigation band. Mobile keeps a centered wordmark, menu and search controls on the left, and cart/account utilities on the right.
- **Typography**: meta links use `12px` tracked labels; primary navigation uses `14px` tracked labels. Preserve locale-provided labels; do not import reference-site copy or replace Korean content.
- **Search**: use the installed Lucide `Search` icon at `18px`, `strokeWidth={1.5}`. It is an accessible link labelled with the translated `Header.search` value and routes to `/{locale}/products`, where the existing catalog search input handles queries. Do not create a second inline search surface.
- **States**: navigation and utility links use `150ms ease-out` color transitions plus a visible `:focus-visible` outline. Icons do not receive decorative animation.
- **Accessibility**: utility controls must retain translated accessible names; desktop and mobile affordances are both keyboard reachable.

### Global Footer

- **Reference contract**: use a charcoal `#1F1F1F` surface, low-contrast dividers, and soft neutral copy. The footer is editorial rather than card-based: no shadows, no boxed link lists.
- **Structure**: desktop presents four navigation columns alongside showroom and contact information; a full-width divider separates the lower contact row. Mobile stacks the same translated columns and preserves the showroom disclosure behavior.
- **Typography**: headings are small, tracked labels; links and contact details use readable body-small text with muted default color and brighter hover/focus state.
- **Spacing**: use the base 4px scale with `48px` mobile and `64px` desktop vertical padding; use `24px` or larger grid gaps so Korean labels remain legible without collision.
- **Accessibility**: preserve semantic footer navigation, visible focus styling, existing translated labels, showroom buttons, and disclosure semantics across all locales.

### Checkout

- **Reference contract**: local-cart checkout uses a calm, two-column editorial composition on desktop: shipping/payment details in the primary column and the order summary in a bordered secondary column. It stacks into one reading order on mobile, placing the sticky order CTA after the agreement controls.
- **Structure**: include a shipping form, ZaloPay and VNPAY radio choices, coupon field, order summary, agreement controls, and a clear primary submission action. The checkout must use the current locale’s cart and preserve its Korean, Vietnamese, and English labels.
- **Spacing & surfaces**: use `--nh-surface-warm` for the page, white content panels, `--nh-border` dividers, and `24px` desktop / `16px` mobile internal gaps. Do not introduce shadows or reference-site assets.
- **States**: support hydrated cart, empty cart, validation error, submission pending, server failure, and successful order. Cart lines and completed form values remain visible after an error; clear the local cart only after a confirmed success.
- **Responsive**: validate at 375px, 768px, and 1280px. The summary remains in normal document flow below `lg`; the desktop CTA may remain sticky within its summary column without obscuring the footer or agreement controls.
- **Accessibility**: use labelled fields, required-field error text, native radio/checkbox controls, an `aria-live` status for submission feedback, visible focus states, and a disabled duplicate-submit state. Reduced motion uses no non-essential animation.
- **Integration constraint**: submit only through the existing legacy `/api/cart/submit` contract. Payment, coupon, and agreement UI do not silently expand that API payload unless the endpoint already supports them.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | `150ms` | `ease-out` | Link and button color changes |
| Standard | `300ms` | `ease-in-out` | Card image hover scale |
| Emphasis | `500ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Optional page reveal |

### Rules

- Only animate `transform` and `opacity`.
- Every interactive card/link has hover and focus-visible states.
- Respect reduced motion by keeping all motion non-essential.

## 7. Depth & Surface

### Strategy

Tonal-shift with thin borders. No heavy card shadows.

| Type | Value | Usage |
|------|-------|-------|
| Default border | `1px solid var(--nh-border)` | Section dividers, about copy separator |
| Subtle surface | `#FAF9F8` to `#FFFFFF` | Separate page and card surfaces |
| Muted tile | `#E1E1E1` | Brand logo cards |
