// Builds the blog into _site/ alongside the hand-written pages.
//
// The landing page, early-access form and legal pages are NOT templates:
// they are copied through byte-for-byte, so nothing about them changes by
// being part of this build. Only /blog/, the sitemap, robots.txt, the feed
// and the 404 page are generated.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import Image, { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { markdown } from "./_config/markdown.js";
import { isLive, readingMinutes, relatedPosts, wordCount } from "./_config/posts.js";

const SITE_URL = "https://www.ndylens.com";

export default function (eleventyConfig) {
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));
  eleventyConfig.setLibrary("md", markdown);

  // ── Hand-written site, copied untouched ───────────────────────────
  [
    "index.html",
    "early-access.html",
    "privacy.html",
    "terms.html",
    "styles.css",
    "script.js",
    "blog.css",
    "CNAME",
    ".nojekyll",
    "favicon.ico",
    "favicon.png",
    "assets/images",
    "assets/fonts",
    "assets/blog/uploads",
  ].forEach((p) => eleventyConfig.addPassthroughCopy(p));

  // ── Images ─────────────────────────────────────────────────────────
  // Every local <img> in generated HTML is resized into a srcset and
  // re-encoded, so an editor can upload a 5 MB photo and a phone still
  // downloads a ~40 KB one. Width/height are written in to prevent layout
  // shift. Output filenames are content hashes, so no cache-busting needed.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    extensions: "html",
    formats: ["avif", "webp", "jpeg"],
    widths: [400, 720, 1080, 1440],
    urlPath: "/assets/blog/img/",
    outputDir: "./_site/assets/blog/img/",
    failOnError: false,
    htmlOptions: {
      imgAttributes: {
        loading: "lazy",
        decoding: "async",
        sizes: "(max-width: 760px) calc(100vw - 36px), 720px",
      },
      pictureAttributes: {},
    },
  });

  // A 1200px JPEG for og:image. WhatsApp and Facebook link previews are
  // unreliable with WebP/AVIF, and WhatsApp is where these links get shared.
  eleventyConfig.addAsyncShortcode("ogImage", async (src) => {
    if (!src) return `${SITE_URL}/assets/images/scene-wedding-960.jpg`;
    const file = path.join(".", src.split("?")[0]);
    if (!fs.existsSync(file)) return new URL(src, SITE_URL).href;
    const meta = await Image(file, {
      widths: [1200],
      formats: ["jpeg"],
      urlPath: "/assets/blog/og/",
      outputDir: "./_site/assets/blog/og/",
    });
    return SITE_URL + meta.jpeg[0].url;
  });

  // ── Collections ────────────────────────────────────────────────────
  const livePosts = (api) =>
    api
      .getFilteredByGlob("blog/posts/*.md")
      .filter((p) => isLive(p.data))
      .sort((a, b) => b.date - a.date);

  eleventyConfig.addCollection("posts", livePosts);

  // Categories that have at least one live post, alphabetical by name.
  eleventyConfig.addCollection("activeCategories", (api) => {
    const posts = livePosts(api);
    const dir = "_data/categories";
    return fs
      .readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => ({ slug: f.replace(/\.ya?ml$/, ""), ...yaml.load(fs.readFileSync(path.join(dir, f), "utf8")) }))
      .map((c) => ({ ...c, posts: posts.filter((p) => p.data.category === c.slug) }))
      .filter((c) => c.posts.length)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // ── Filters ────────────────────────────────────────────────────────
  const hashes = new Map();
  eleventyConfig.addFilter("assetHash", (url) => {
    if (!hashes.has(url)) {
      const file = path.join(".", url);
      const digest = fs.existsSync(file)
        ? crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex").slice(0, 8)
        : "0";
      hashes.set(url, digest);
    }
    return `${url}?v=${hashes.get(url)}`;
  });

  eleventyConfig.addFilter("absoluteUrl", (url) => new URL(url || "/", SITE_URL).href);

  const lagos = { timeZone: "Africa/Lagos" };
  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-GB", { ...lagos, day: "numeric", month: "long", year: "numeric" })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString());
  eleventyConfig.addFilter("rfc822", (d) => new Date(d).toUTCString());

  eleventyConfig.addFilter("readingMinutes", readingMinutes);
  eleventyConfig.addFilter("wordCount", wordCount);
  eleventyConfig.addFilter("relatedPosts", relatedPosts);

  // JSON for <script type="application/ld+json">. JSON.stringify alone would
  // let a "</script>" inside an article title close the tag early.
  eleventyConfig.addFilter("jsonLd", (obj) =>
    JSON.stringify(obj).replace(/</g, "\\u003c")
  );

  eleventyConfig.addFilter("truncate", (s = "", n = 160) =>
    s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"
  );

  // Never let unrelated files in the repo become pages.
  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("TRACKING.md");
  eleventyConfig.ignores.add("BLOG.md");

  eleventyConfig.setServerOptions({ port: 8080 });

  return {
    dir: { input: ".", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
