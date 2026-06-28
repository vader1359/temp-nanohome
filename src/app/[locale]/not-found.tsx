export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center">
      <h2 className="text-2xl font-semibold">404 — Page not found</h2>
      <p className="text-sm text-muted-foreground">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
    </div>
  );
}
