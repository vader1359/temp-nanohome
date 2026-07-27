const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

export const privateJson = (body: unknown, status = 200): Response => Response.json(body, {
  headers: privateHeaders,
  status,
});

export const withPrivateErrorBoundary = <Arguments extends readonly unknown[]>(
  handler: (...arguments_: Arguments) => Promise<Response>,
) => async (...arguments_: Arguments): Promise<Response> => {
  try {
    return await handler(...arguments_);
  } catch {
    return privateJson({ error: "Internal server error" }, 500);
  }
};
