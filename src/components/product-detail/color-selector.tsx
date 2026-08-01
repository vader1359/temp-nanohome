"use client";

type ColorSelectorProps = Readonly<{
  header?: string;
  colors?: readonly Readonly<{ name: string; hex: string }>[];
  className?: string;
}>;

export function ColorSelector(props: ColorSelectorProps) {
  void props;
  return null;
}
