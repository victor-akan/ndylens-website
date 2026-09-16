import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as yaml from "js-yaml";

const root = process.cwd();
const fail = (message) => { throw new Error(message); };
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const base = process.env.BASE_SHA || "origin/main";
const head = process.env.HEAD_SHA || "HEAD";
const changed = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const allowed = /^(blog\/posts\/[^/]+\.md|assets\/blog\/uploads\/[^/]+)$/;
const unrelated = changed.filter((file) => !allowed.test(file));
if (unrelated.length) fail(`Unrelated files changed: ${unrelated.join(", ")}`);

const articles = changed.filter((file) => /^blog\/posts\/[^/]+\.md$/.test(file));
if (articles.length !== 1) fail(`Expected exactly one changed article, found ${articles.length}`);
const imageChanges = changed.filter((file) => file.startsWith("assets/blog/uploads/"));
if (imageChanges.length !== 1) fail(`Expected exactly one changed featured image, found ${imageChanges.length}`);

const allPosts = fs.readdirSync(path.join(root, "blog/posts")).filter((f) => f.endsWith(".md"));
const slugs = allPosts.map((f) => path.basename(f, ".md"));
if (new Set(slugs).size !== slugs.length) fail("Duplicate post slug detected");

for (const file of articles) {
  const source = read(file);
  if (source.includes("—")) fail(`${file} contains an em dash`);
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) fail(`${file} has invalid frontmatter delimiters`);
  const data = yaml.load(match[1]);
  const body = match[2];
  const required = ["title", "slug", "status", "date", "author", "category", "tags", "excerpt", "featured_image", "featured_image_alt", "cta", "related"];
  for (const key of required) if (data[key] === undefined || data[key] === null || data[key] === "") fail(`${file}: missing ${key}`);
  if (!data.seo?.title || !data.seo?.description) fail(`${file}: missing SEO title or description`);
  if (!("canonical" in data.seo) || typeof data.seo.noindex !== "boolean") fail(`${file}: canonical/noindex configuration is invalid`);
  if (!Array.isArray(data.tags) || !data.tags.length) fail(`${file}: tags must be a non-empty list`);
  if (!Array.isArray(data.related)) fail(`${file}: related must be a list`);
  if (!['draft', 'published', 'archived'].includes(data.status)) fail(`${file}: invalid status`);
  if (Number.isNaN(new Date(data.date).getTime())) fail(`${file}: invalid publication date`);
  const filenameSlug = path.basename(file, ".md");
  if (data.slug !== filenameSlug) fail(`${file}: slug must match filename`);
  if (!exists(`_data/categories/${data.category}.yml`)) fail(`${file}: unknown category ${data.category}`);
  if (!exists(`_data/ctas/${data.cta}.yml`)) fail(`${file}: unknown CTA ${data.cta}`);
  for (const related of data.related) if (!exists(`blog/posts/${related}.md`)) fail(`${file}: missing related article ${related}`);
  const imagePath = String(data.featured_image).replace(/^\//, "");
  if (!exists(imagePath)) fail(`${file}: featured image does not exist: ${imagePath}`);
  if (!imageChanges.includes(imagePath)) fail(`${file}: featured image is not the article image added in this PR`);
  if (!/^\/assets\/blog\/uploads\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/.test(data.featured_image)) fail(`${file}: invalid featured image path`);
  if (!body.match(/\n##\s+/)) fail(`${file}: article needs H2 sections`);
  if (!body.match(/\[[^\]]+\]\([^\)]+\)/)) fail(`${file}: article needs contextual links`);

  const internalLinks = [...body.matchAll(/\[[^\]]+\]\((\/[^)#?]*)(?:[?#][^)]*)?\)/g)].map((m) => m[1]);
  for (const link of internalLinks) {
    if (link === "/" || link === "/blog/" || link === "/early-access.html") continue;
    const postMatch = link.match(/^\/blog\/([^/]+)\/$/);
    if (postMatch && exists(`blog/posts/${postMatch[1]}.md`)) continue;
    const diskPath = link.replace(/^\//, "");
    if (exists(diskPath) || exists(`${diskPath}.html`)) continue;
    fail(`${file}: unresolved internal link ${link}`);
  }

  const previewHtml = read(`_site/blog/${filenameSlug}/index.html`);
  const expectedCanonical = data.seo.canonical || `https://www.ndylens.com/blog/${filenameSlug}/`;
  for (const needle of [
    `<link rel="canonical" href="${expectedCanonical}"`,
    "property=\"og:title\"",
    "property=\"og:description\"",
    "property=\"og:image\"",
    '"@type":"BlogPosting"',
  ]) if (!previewHtml.includes(needle)) fail(`${file}: rendered preview missing ${needle}`);
  if (!previewHtml.includes(data.title)) fail(`${file}: rendered preview missing title`);
  if (!previewHtml.includes(data.featured_image)) fail(`${file}: rendered preview missing featured image`);
  if (!previewHtml.includes("post-cta-card")) fail(`${file}: rendered preview missing CTA`);

  const due = data.status === "published" && new Date(data.date) <= new Date();
  if (due) {
    const publicHtmlPath = `_site-public/blog/${filenameSlug}/index.html`;
    if (!exists(publicHtmlPath)) fail(`${file}: due article missing from public build`);
    for (const output of ["_site-public/sitemap.xml", "_site-public/blog/feed.xml"])
      if (!read(output).includes(`/blog/${filenameSlug}/`)) fail(`${file}: due article missing from ${output}`);
  }
}

console.log(`Validated ${articles[0]} and ${imageChanges[0]}`);
