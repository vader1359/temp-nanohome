import Link from "next/link";

// Root 404. Reached when `notFound()` is thrown outside the [locale] segment
// (e.g. layout.tsx rejects an unknown locale) or for unmatched top-level URLs.
// Keep styling to shadcn + Tailwind only; no custom styling per plan T236.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="text-primary underline underline-offset-4 hover:opacity-80"
      >
        Return Home
      </Link>
    </main>
  );
}