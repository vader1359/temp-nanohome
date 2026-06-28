import { COLORS } from "./mock-data";

// Compact, non-interactive color swatch row for product cards.
export function ColorDots({ colors = COLORS }: { colors?: { name: string; hex: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <span
          key={c.name}
          className="block rounded-full"
          style={{
            width: 14,
            height: 14,
            background: c.hex,
            border: c.hex.toLowerCase() === "#e8e8e8" ? "1px solid #ddd" : undefined,
          }}
        />
      ))}
    </div>
  );
}