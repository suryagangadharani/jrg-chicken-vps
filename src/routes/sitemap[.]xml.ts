import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { apiClient } from "@/lib/api-client";

const BASE_URL = "https://jrgchicken.in";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/products", changefreq: "daily", priority: "0.9" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const [products, categories] = await Promise.all([
            apiClient.products.getAll().catch(() => []),
            apiClient.categories.getAll().catch(() => []),
          ]);
          for (const c of categories ?? []) {
            if (c?.slug) entries.push({ path: `/products?category=${encodeURIComponent(c.slug)}`, changefreq: "daily", priority: "0.8" });
          }
          for (const p of products ?? []) {
            if (p?.slug) entries.push({ path: `/products/${p.slug}`, changefreq: "weekly", priority: "0.7" });
          }
        } catch (e) {
          console.error("sitemap dynamic entries failed", e);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
