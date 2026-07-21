import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "CA Performance", robots: { index: false, follow: false } };

export default async function CaPerformancePage() {
  const authenticated = (await headers()).get("x-ca-performance-auth") === "granted";
  if (!authenticated) return <form action="/api/ca-performance/auth" method="post" className="flex min-h-screen items-center justify-center gap-3"><input name="password" type="password" placeholder="Password" className="border px-3 py-2" /><button className="bg-black px-4 py-2 text-white">Continue</button></form>;
  return <main className="min-h-screen"><iframe title="15072026_fixed_final_sale_dashboard" src={process.env.CA_PERFORMANCE_EMBED_URL} className="h-screen w-full border-0" allowFullScreen /></main>;
}
