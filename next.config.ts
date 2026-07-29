import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Side-effect import: validates required env vars via the zod schema in
// `src/lib/env.ts` at config-load time. `next build` / `next dev` / `next start`
// all evaluate next.config.ts eagerly, so a missing SUPABASE_SERVICE_ROLE_KEY
// or CRON_SECRET (or invalid NEXT_PUBLIC_SUPABASE_URL) aborts the build with a
// zod error before any code runs.
import "./src/lib/env";
import { firebaseAuthHelperRewrites } from "./src/lib/auth/firebase-auth-helper-rewrite";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const publicMediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/+$/, "");

type WebpackConfig = Parameters<NonNullable<NextConfig["webpack"]>>[0];
type WatchIgnored = NonNullable<NonNullable<WebpackConfig["watchOptions"]>["ignored"]>;

const ignoredDevArtifacts = ["**/.playwright-mcp/**", "**/.omo/**", "**/.debug-journal.md"];

function ignoredEntries(ignored: WatchIgnored | undefined): string[] {
  if (ignored === undefined) return [];
  return Array.isArray(ignored) ? ignored.map(String) : [String(ignored)];
}

const nextConfig: NextConfig = {
  async rewrites() {
    return firebaseAuthHelperRewrites(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  },
  reactCompiler: true,
  experimental: {
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
  },
  webpack(config) {
    config.infrastructureLogging = { level: "error" };
    return {
      ...config,
      watchOptions: {
        ...config.watchOptions,
        ignored: [...ignoredEntries(config.watchOptions?.ignored), ...ignoredDevArtifacts],
      },
    } satisfies WebpackConfig;
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // The public R2 hostname is deployment-specific. Keep the pattern exact
      // by deriving it from the public media base URL rather than allowing all
      // r2.dev tenants.
      ...(publicMediaUrl ? [new URL(`${publicMediaUrl}/**`)] : []),
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/nanohome-web/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s3-alpha-sig.figma.com",
        pathname: "/img/**",
      },
      {
        protocol: "https",
        hostname: "v5.airtableusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.fbsbx.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "scontent.cdninstagram.com",
        pathname: "/**",
      },
    ],
  },
  // next-intl 3.x wires `next-intl/config` through `experimental.turbo`,
  // which Next 16 ignores; register the alias via the supported top-level key.
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
};

const baseConfig = withNextIntl(nextConfig);

type ConfigWithLegacyTurbo = NextConfig & {
  experimental?: NextConfig["experimental"] & {
    turbo?: NonNullable<NextConfig["turbopack"]>;
  };
};

const normalizedConfig = baseConfig as ConfigWithLegacyTurbo;

if (normalizedConfig.experimental?.turbo) {
  normalizedConfig.turbopack = {
    ...normalizedConfig.experimental.turbo,
    ...normalizedConfig.turbopack,
    resolveAlias: {
      ...normalizedConfig.experimental.turbo.resolveAlias,
      ...normalizedConfig.turbopack?.resolveAlias,
    },
  };

  delete normalizedConfig.experimental.turbo;
}

export default normalizedConfig;
