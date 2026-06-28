import { ColorSwatches } from "@/components/shared";
import { COLORS } from "./mock-data";

// Compact, non-interactive color swatch row for product cards.
export function ColorDots({ colors = COLORS }: { colors?: { name: string; hex: string }[] }) {
  return (
    <ColorSwatches
      colors={colors.map((c) => ({ color: c.hex, name: c.name }))}
      variant="dots"
    />
  );
}