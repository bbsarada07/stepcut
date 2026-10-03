import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by Elah: its packages and mediabunny ship modern ESM that the app
  // must transpile, and this lets the bundler emit the export Web Worker.
  transpilePackages: ["@elah/editor", "@elah/core", "@elah/react", "@elah/timeline", "mediabunny"],
};

export default nextConfig;
