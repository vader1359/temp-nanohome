import { NextResponse } from "next/server";
export const POST = async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  if (origin === null || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origin required" }, { status: 403 });
  return NextResponse.json({ error: "Event collection policy unavailable" }, { status: 503 });
};
