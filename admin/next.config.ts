import type { NextConfig } from "next";

// The API origin has to come from env, not a literal. Hardcoding
// http://localhost:5000 is why uploaded images 404 on the live site and why
// next/image throws "hostname is not configured" the moment the API moves to a
// real domain — the local machine is the only place the literal is true.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const apiOrigin = (() => {
  try {
    return new URL(apiUrl);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_URL is not a valid URL: ${JSON.stringify(apiUrl)}`,
    );
  }
})();

/**
 * Next 16 refuses to fetch an image whose hostname resolves to a private
 * address (localhost, 127.x, 10.x, 192.168.x, ...) — an SSRF guard — and
 * answers `"url" parameter is not allowed` with a 400. This dashboard builds
 * absolute `${NEXT_PUBLIC_API_URL}/uploads/...` srcs, so in local development
 * every product, avatar and ad image hit that guard and rendered blank.
 *
 * The opt-out is enabled only when the configured API really is a local
 * address. In production NEXT_PUBLIC_API_URL points at a public host, this
 * evaluates to false, and the guard stays on where it actually matters.
 */
const PRIVATE_HOST =
  /^(localhost|::1|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

const apiIsLocal = PRIVATE_HOST.test(apiOrigin.hostname.replace(/^\[|\]$/g, ""));

const nextConfig: NextConfig = {
  /**
   * Pins the build root to this app.
   *
   * Without it Next walks up looking for a lockfile, finds the repo root's
   * before this one's, and treats the whole monorepo as the workspace — the
   * "inferred your workspace root, but it may not be correct" warning on every
   * build. That root is what module resolution and file tracing are anchored
   * to, so the storefront and the server get dragged into the admin build's
   * scope. On a small VPS that is memory the build cannot spare.
   */
  turbopack: {
    root: __dirname,
  },

  experimental: {
    /**
     * Keeps Turbopack's dev cache on disk between runs.
     *
     * Without it every `next dev` recompiles the whole route from scratch —
     * on this repo that is the ~60s first request after each restart. With it
     * the second and later starts read what the previous run already built.
     *
     * If a start ever fails oddly after upgrading Next, delete `.next/dev`:
     * that is the whole cache, and it is rebuilt on the next run.
     */
    // DISABLED on this machine: the on-disk cache grew to 4.2 GB in
    // .next/dev, which exhausted a 7.6 GB machine and took VS Code and the
    // dev servers down with it. The cost of leaving it off is a slower first
    // compile after each restart. Re-enable it on a machine with more RAM.
    turbopackFileSystemCacheForDev: false,

    /**
     * `react-icons/fa` is a barrel over ~1,600 icon modules, and the footer
     * imports from it, so every page that renders the footer pulled all of
     * them into the dev graph. Next already does this for `lucide-react`;
     * these two subpaths are the ones this app actually imports.
     */
    optimizePackageImports: ["react-icons/fa", "react-icons/fa6"],
  },

  /**
   * How long a compiled page stays in memory before dev throws it away.
   * The default minute means coming back to a screen a few minutes later
   * recompiles it; an hour covers a working session.
   */
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 8,
  },

  async rewrites() {
    return [
      {
        // Keeps uploads same-origin for the browser, which sidesteps CORS for
        // images entirely and lets next/image cache them.
        source: "/uploads/:path*",
        destination: `${apiOrigin.origin}/uploads/:path*`,
      },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: apiIsLocal,
    remotePatterns: [
      {
        protocol: apiOrigin.protocol.replace(":", "") as "http" | "https",
        hostname: apiOrigin.hostname,
        ...(apiOrigin.port ? { port: apiOrigin.port } : {}),
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "cdn.magicpatterns.com",
      },
    ],
  },
};

export default nextConfig;
