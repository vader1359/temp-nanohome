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
