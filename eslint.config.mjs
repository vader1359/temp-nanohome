import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Block client-side imports of the server-only Supabase admin client.
  //
  // ESLint flat config cannot match files by their `"use client"` directive
  // content, so we block `@/lib/supabase/admin` everywhere under `src/`
  // *except* known server-only entry points (route handlers, server action
  // files, and the supabase lib itself). The admin client uses the service
  // role key and bypasses RLS — it must never run in the browser.
  {
    name: "block-supabase-admin-from-client",
    files: ["src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
    ignores: [
      "src/lib/supabase/**",
      "src/lib/amis/sync.ts",
      "src/lib/queries/cart.ts",
      "src/app/api/**",
      "**/route.{ts,tsx,js,jsx}",
      "**/actions.{ts,tsx,js,jsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin"],
              message:
                "src/lib/supabase/admin is server-only (uses the Supabase service role key and bypasses RLS). Importing it into a client component leaks secrets. Use src/lib/supabase/browser.ts or src/lib/supabase/server.ts instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
