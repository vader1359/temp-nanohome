export function isContactPrice(price: number | null): boolean {
  return price === null || Number(price) === 1;
}
