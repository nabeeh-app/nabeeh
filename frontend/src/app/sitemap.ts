import type { MetadataRoute } from "next";
import { posts } from "@/lib/blog-data";

const BASE_URL = "https://nabeeh.app";

const publicPages = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/login", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/register", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/terms", priority: 0.3, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.3, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of publicPages) {
    for (const locale of ["en", "ar"]) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: {
            en: `${BASE_URL}/en${page.path}`,
            ar: `${BASE_URL}/ar${page.path}`,
          },
        },
      });
    }
  }

  for (const post of posts) {
    for (const locale of ["en", "ar"]) {
      entries.push({
        url: `${BASE_URL}/${locale}/blog/${post.slug}`,
        lastModified: new Date(post.date),
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: {
          languages: {
            en: `${BASE_URL}/en/blog/${post.slug}`,
            ar: `${BASE_URL}/ar/blog/${post.slug}`,
          },
        },
      });
    }
  }

  return entries;
}
