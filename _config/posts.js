// Publishing rules and helpers shared by the config and the post data file.

const preview = process.env.BLOG_PREVIEW === "1";
const buildTime = new Date();

// A post is on the public site only when it is marked Published and its
// publish date has arrived. Drafts, archived posts and posts scheduled for
// the future produce no page, no sitemap entry and no feed item.
export function isLive(data) {
  if (preview) return data.status !== "archived";
  if (data.status !== "published") return false;
  return new Date(data.date) <= buildTime;
}

export function readingMinutes(html = "") {
  const words = String(html).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function wordCount(text = "") {
  return String(text).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

// Up to `limit` related posts. Hand-picked ones (the "Related articles"
// field) come first, in the order chosen; the rest are filled by shared
// category, then shared tags, then recency.
export function relatedPosts(posts = [], url, current = {}, limit = 3) {
  const others = posts.filter((p) => p.url !== url);
  const bySlug = new Map(others.map((p) => [p.fileSlug, p]));
  const picked = (current.related || []).map((s) => bySlug.get(s)).filter(Boolean);

  const tags = new Set(current.tags || []);
  const score = (p) =>
    (p.data.category && p.data.category === current.category ? 10 : 0) +
    (p.data.tags || []).filter((t) => tags.has(t)).length;

  const rest = others
    .filter((p) => !picked.includes(p))
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s || b.p.date - a.p.date)
    .map(({ p }) => p);

  return [...picked, ...rest].slice(0, limit);
}
