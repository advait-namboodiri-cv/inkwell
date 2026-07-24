import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "jsdom", "pdfkit", "pdf-parse"],
};

export default nextConfig;
