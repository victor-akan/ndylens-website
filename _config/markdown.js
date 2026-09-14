// Markdown rendering for article bodies, with three SEO/readability rules
// enforced here rather than trusted to whoever writes the article:
//
// 1. One H1 per page. The article title is the H1, so any "# Heading" in the
//    body is demoted to H2, and every level below shifts down with it.
// 2. H2/H3 get stable ids, so sections can be linked to (#pricing) and a
//    table of contents is possible later.
// 3. An image on its own line with a title — ![alt](src "Caption") — becomes
//    a <figure> with a <figcaption>, so captions never need HTML.
import markdownIt from "markdown-it";

export const markdown = markdownIt({ html: true, linkify: true, typographer: true });

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

markdown.core.ruler.push("ndylens_headings_figures", (state) => {
  const tokens = state.tokens;
  const seen = new Map();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "heading_open" || t.type === "heading_close") {
      const level = Math.min(6, Number(t.tag.slice(1)) + (demoteAll(tokens) ? 1 : 0));
      t.tag = "h" + level;
      if (t.type === "heading_open" && level <= 3) {
        const text = tokens[i + 1].children.map((c) => c.content).join("");
        let id = slug(text) || "section";
        const n = seen.get(id) || 0;
        seen.set(id, n + 1);
        if (n) id += "-" + n;
        t.attrSet("id", id);
      }
    }

    // paragraph containing exactly one image → hide the <p>, flag the image
    if (
      t.type === "paragraph_open" &&
      tokens[i + 1]?.type === "inline" &&
      tokens[i + 1].children.length === 1 &&
      tokens[i + 1].children[0].type === "image" &&
      tokens[i + 2]?.type === "paragraph_close"
    ) {
      const img = tokens[i + 1].children[0];
      if (img.attrGet("title")) {
        t.hidden = true;
        tokens[i + 2].hidden = true;
        img.meta = { ...(img.meta || {}), figure: true };
      }
    }
  }
});

// If the body uses H1 anywhere, shift *every* heading down one level so the
// hierarchy the author intended (H1 > H2 > H3) survives as H2 > H3 > H4.
function demoteAll(tokens) {
  if (tokens._ndyDemote === undefined) {
    tokens._ndyDemote = tokens.some((t) => t.type === "heading_open" && t.tag === "h1");
  }
  return tokens._ndyDemote;
}

const defaultImage = markdown.renderer.rules.image;
markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (!token.meta?.figure) return defaultImage(tokens, idx, options, env, self);
  const caption = token.attrGet("title");
  token.attrs = token.attrs.filter(([name]) => name !== "title");
  const img = defaultImage(tokens, idx, options, env, self);
  return `<figure class="post-figure">${img}<figcaption>${markdown.utils.escapeHtml(caption)}</figcaption></figure>\n`;
};

// External links open normally (no target=_blank — it breaks the back button
// on mobile) but carry rel="noopener" and are marked for styling.
const defaultLinkOpen =
  markdown.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (/^https?:\/\//.test(href) && !/^https?:\/\/(www\.)?ndylens\.com/.test(href)) {
    tokens[idx].attrSet("rel", "noopener");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};
