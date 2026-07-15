import { HydrationBoundary, dehydrate, QueryClient } from "@tanstack/react-query";
import { setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/products/products-page";
import { isSupportedLocale } from "@/i18n/routing";
import { getProductPage } from "@/lib/products/products-service";
import { parseFilters, buildQueryKey } from "@/lib/products/filter-utils";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsRoute({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  setRequestLocale(locale);

  const sp = await searchParams;
  const filters = parseFilters(sp);

  // Fetch the data on the server.
  const pageData = await getProductPage(locale, filters);

  // Prefetch & dehydrate query state to pass to Client Components.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
    },
  });
  const queryKey = buildQueryKey(locale, filters);
  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => Promise.resolve(pageData),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductsPage
        brandOptions={pageData.brandOptions}
        categoryOptions={pageData.categoryOptions}
        roomOptions={pageData.roomOptions}
        locale={locale}
      />
    </HydrationBoundary>
  );
}
