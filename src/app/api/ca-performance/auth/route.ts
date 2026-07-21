import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData();
  if (form.get("password") !== (process.env.CA_PERFORMANCE_PASSWORD ?? "nanoCAp3rf")) return NextResponse.redirect(new URL("/ca-performance", request.url));
  const response = NextResponse.redirect(new URL("/ca-performance", request.url));
  response.cookies.set("ca-performance-auth", process.env.CA_PERFORMANCE_AUTH_TOKEN ?? "nanoCAp3rf", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/ca-performance", maxAge: 43200 });
  return response;
}
