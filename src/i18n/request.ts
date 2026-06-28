import { getRequestConfig } from "next-intl/server";
import { isSupportedLocale, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  if (!isSupportedLocale(requested)) {
    throw new Error(
      `Unsupported locale requested: ${requested ?? "(none)"}. Supported locales: ${routing.locales.join(", ")}.`,
    );
  }

  return {
    locale: requested,
    messages: (await import(`../../messages/${requested}.json`)).default,
  };
});
