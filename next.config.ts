import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone: a traced server plus only the node_modules it
  // actually reaches. The Dockerfile's runtime stage copies that instead of
  // the full dependency tree, which is the difference between a ~200MB image
  // and a ~1.2GB one.
  output: "standalone",
};

export default nextConfig;
