import { BRAND_CONFIG } from "../shared/config";

export function updatePageMetadata(page: string, title: string): void {
  const publicPage = page === "booking";
  const publicTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content;
  document.title = publicPage && publicTitle ? publicTitle : `${title} · ${BRAND_CONFIG.name}`;
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (robots)
    robots.content = publicPage
      ? "index, follow, max-image-preview:large"
      : "noindex, nofollow, noarchive";
}
