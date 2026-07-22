export function retiredCommerceScaffoldResponse(..._args: readonly unknown[]): Response {
  void _args;
  return Response.json(
    { error: "commerce_scaffold_retired" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
