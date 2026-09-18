import type { NextConfig } from "next";

const nextConfig: NextConfig = { images: {
  dangerouslyAllowLocalIP: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true",
  remotePatterns: [
  { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
  { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
  { protocol: "http", hostname: "127.0.0.1", port: "9199", pathname: "/**" },
] } };

export default nextConfig;
