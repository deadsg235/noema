import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Allow images from generation providers
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "pbxt.replicate.delivery" },
    ],
  },

  // Required for Electron — disables hostname check
  ...(process.env.ELECTRON === "true" && {
    output: "standalone",
  }),

  // Silence the turbopack root warning in monorepo setups
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
