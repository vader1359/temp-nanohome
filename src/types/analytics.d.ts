export {};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { readonly queue?: readonly unknown[][] };
  }
}
