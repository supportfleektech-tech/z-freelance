import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public, indexable surfaces — dashboards and the API are robots-excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env().APP_URL.replace(/\/$/, "");
  const pages = [
    "",
    "/projects",
    "/freelancers",
    "/docs",
    "/docs/architecture",
    "/login",
    "/register",
  ];
  return pages.map((page) => ({
    url: `${base}${page || "/"}`,
    lastModified: new Date(),
    changeFrequency: page === "" || page === "/projects" ? "hourly" : "daily",
    priority: page === "" ? 1 : 0.7,
  }));
}
