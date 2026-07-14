import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/products/filter-utils";
import { getProductPage } from "@/lib/products/products-service";
import { isSupportedLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") || "vi";

    if (!isSupportedLocale(locale)) {
      return new NextResponse(
        JSON.stringify({ error: `Unsupported locale: ${locale}` }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const filters = parseFilters(searchParams);
    const result = await getProductPage(locale, filters);

    return new NextResponse(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new NextResponse(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
