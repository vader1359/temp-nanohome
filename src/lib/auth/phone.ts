import { normalizeInternationalPhone } from "./phone-e164";

export function normalizeVietnamPhone(value: string): string | null {
  return normalizeInternationalPhone(value);
}
