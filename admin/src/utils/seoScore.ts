/**
 * The SEO checklist beside the post editor, scored as you type.
 *
 * Mirrors `windrise-server/src/app/modules/blog/blog.seo.ts` exactly — the
 * server recomputes the same score on save so the list view and the editor
 * never disagree. Change one, change the other.
 *
 * Everything is read from what the reader gets: the compiled article HTML
 * (every image's alt text, every link) plus the post's own fields.
 */
export type SeoCheck = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
};

export type SeoInput = {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  lead?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  content?: string | null;
  featuredImage?: string | null;
};

const SITE_HOSTS = /(^|\.)thewindrise\.com$|(^|\.)windrise\.com$/i;

/** Strip tags without a DOM so this also works during SSR. */
export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase words only — "Bangladesh's" and "bangladesh" compare equal. */
const norm = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function countWords(html?: string | null, extra = ""): number {
  const text = `${extra} ${stripHtml(html)}`.trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

const imagesIn = (html: string) =>
  [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => {
    const alt = /\balt\s*=\s*"([^"]*)"/i.exec(match[0])?.[1] ?? "";
    return { hasAlt: alt.trim().length > 0 };
  });

const linksIn = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]+)"/gi)].map((match) => match[1]);

const isInternal = (href: string) => {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    return SITE_HOSTS.test(new URL(href).hostname);
  } catch {
    return false;
  }
};

const isExternal = (href: string) => /^https?:\/\//i.test(href) && !isInternal(href);

export function buildSeoChecks(input: SeoInput): SeoCheck[] {
  const title = (input.title ?? "").trim();
  const description = (input.metaDescription ?? "").trim() || (input.excerpt ?? "").trim();
  const keyword = norm(input.focusKeyword ?? "");
  const html = input.content ?? "";
  const lead = input.lead ?? "";
  const slug = (input.slug ?? "").trim();

  const images = imagesIn(html);
  const imageCount = images.length + (input.featuredImage ? 1 : 0);
  const words = countWords(html, lead);
  const links = linksIn(html);

  return [
    {
      id: "title",
      label: "Post title (10–70 characters)",
      passed: title.length >= 10 && title.length <= 70,
      weight: 12,
    },
    {
      id: "meta-description",
      label: "Meta description (120–160 characters)",
      passed: description.length >= 120 && description.length <= 160,
      weight: 12,
    },
    { id: "focus-keyword", label: "Focus keyword added", passed: Boolean(keyword), weight: 10 },
    {
      id: "keyword-title",
      label: "Focus keyword in title",
      passed: Boolean(keyword) && norm(title).includes(keyword),
      weight: 10,
    },
    {
      id: "keyword-intro",
      label: "Focus keyword in introduction",
      passed: Boolean(keyword) && norm(`${lead} ${input.excerpt ?? ""}`).includes(keyword.split(" ")[0]),
      weight: 6,
    },
    { id: "images", label: "At least 2 images", passed: imageCount >= 2, weight: 10 },
    {
      id: "alt-text",
      label: "Alt text on every image",
      passed: images.every((image) => image.hasAlt),
      weight: 8,
    },
    {
      id: "word-count",
      label: `Content length (800+ words) · ${words} now`,
      passed: words >= 800,
      weight: 14,
    },
    { id: "internal-links", label: "Add internal links", passed: links.some(isInternal), weight: 8 },
    { id: "external-links", label: "Add external links", passed: links.some(isExternal), weight: 5 },
    {
      id: "permalink",
      label: "Short, readable permalink",
      passed: slug.length > 0 && slug.length <= 60,
      weight: 5,
    },
  ];
}

export function computeSeoScore(input: SeoInput): number {
  const checks = buildSeoChecks(input);
  const words = countWords(input.content, input.lead ?? "");
  const total = checks.reduce((sum, check) => {
    if (check.passed) return sum + check.weight;
    // Length earns partial credit on the way to 800 words.
    if (check.id === "word-count") return sum + Math.round(check.weight * Math.min(1, words / 800) * 0.8);
    return sum;
  }, 0);
  return Math.min(100, total);
}

export function seoBand(score: number): "Good" | "OK" | "Needs work" {
  return score >= 80 ? "Good" : score >= 55 ? "OK" : "Needs work";
}

export function seoBandColor(score: number): string {
  return score >= 80 ? "#16a34a" : score >= 55 ? "#d97706" : "#e11d48";
}
