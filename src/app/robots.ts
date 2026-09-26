import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Generated alongside (and taking precedence over) public/robots.txt. */
export default function robots(): MetadataRoute.Robots {
  const base = env().APP_URL.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", disallow: ["/admin", "/dashboard", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
