import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure React Testing Library nodes are unmounted after each test to keep
// the jsdom document clean and prevent cross-test state leakage.
afterEach(() => {
  cleanup();
});