import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Side-effect import: validates required env vars via the zod schema in
// `src/lib/env.ts` at config-load time. `next build` / `next dev` / `next start`
// all evaluate next.config.ts eagerly, so a missing SUPABASE_SERVICE_ROLE_KEY
// or CRON_SECRET (or invalid NEXT_PUBLIC_SUPABASE_URL) aborts the build with a
// zod error before any code runs.
import "./src/lib/env";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/nanohome-web/**",
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
