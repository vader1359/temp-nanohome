export const SEPAY_TEST_VIETQR_URL = "https://vietqr.app/img";
export const SEPAY_TEST_PAYMENT_REFERENCE_PATTERN = /^WEB[A-Z0-9]{12}$/u;

export function isSePayTestPaymentReference(value: string): boolean {
  return SEPAY_TEST_PAYMENT_REFERENCE_PATTERN.test(value);
}

export function isExpectedSePayTestVietQrUrl(
  value: string,
  expected: Readonly<{ amount: number; merchantReference: string }>,
): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const allowedParameters = [
    "acc",
    "amount",
    "bank",
    "des",
    "fullacc",
    "showinfo",
    "template",
  ];
  return `${url.origin}${url.pathname}` === SEPAY_TEST_VIETQR_URL
    && url.username === ""
    && url.password === ""
    && url.hash === ""
    && [...url.searchParams.keys()].every((key) => allowedParameters.includes(key))
    && allowedParameters.every((key) => url.searchParams.has(key))
    && url.searchParams.get("acc") !== ""
    && /^[A-Z0-9]+$/u.test(url.searchParams.get("bank") ?? "")
    && url.searchParams.get("amount") === String(expected.amount)
    && url.searchParams.get("des") === expected.merchantReference
    && url.searchParams.get("template") === "compact"
    && url.searchParams.get("showinfo") === "true"
    && url.searchParams.get("fullacc") === "true";
}
