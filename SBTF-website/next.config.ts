import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sb/shared"],
  turbopack: {
    // Pin the monorepo root so Turbopack does not auto-detect a stray lockfile
    // in a parent directory (e.g. the user home folder on Windows).
    root: path.resolve(".."),
  },
};

export default nextConfig;
