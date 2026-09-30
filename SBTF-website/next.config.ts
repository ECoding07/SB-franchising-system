import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sb/shared"],
  // Monorepo: trace server files from the workspace root so the
  // @sb/shared workspace package resolves on Vercel (Root Directory
  // SBTF-website, single lockfile at repo root).
  outputFileTracingRoot: path.resolve(".."),
  turbopack: {
    // Pin the monorepo root so Turbopack does not auto-detect a stray lockfile
    // in a parent directory (e.g. the user home folder on Windows).
    root: path.resolve(".."),
  },
};

export default nextConfig;
