"use client";

import { useState } from "react";
import { COLORS } from "./mock-data";
import { cn } from "@/lib/utils";

export function ColorSelector({
  header = "MÀU SẮC:",
  colors = COLORS,
  className,
}: {
  header?: string;
  colors?: { name: string; hex: string }[];
  className?: string;
}) {
  return null;
}