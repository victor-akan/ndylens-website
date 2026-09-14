# NDYLens Blog

The blog lives at **ndylens.com/blog/**. Each article is one Markdown file in
`blog/posts/`, and adding or editing a file on GitHub updates the site about
1–2 minutes later.

- [Publishing an article](#publishing-an-article)
- [One-time setup](#one-time-setup)
- [How it works (for developers)](#how-it-works-for-developers)

---

## Publishing an article

All of this can be done in the browser on github.com.

1. **Upload images (if any).** Open `assets/blog/uploads/` → **Add file → Upload files**. Use lowercase names with hyphens, e.g. `studio-family-portrait.jpg`. Upload the best-quality photo you have; the site makes small, fast versions automatically.
2. **Create the article.** Open `blog/posts/` → **Add file → Create new file**. The file name is the URL, so `how-to-price-wedding-photography.md` becomes ndylens.com/blog/how-to-price-wedding-photography/.
3. **Paste this template** and fill it in:

```markdown
---
title: "How to Price Wedding Photography in Nigeria"
status: draft
date: 2026-10-01T09:00:00+01:00
author: NDYLens Team
category: bookings-sales
tags:
  - wedding photography pricing
excerpt: "One or two sentences shown on article cards and under the title."
featured_image: /assets/blog/uploads/studio-family-portrait.jpg
featured_image_alt: "Describe what is in the photo"
seo:
  title: "How to Price Wedding Photography in Nigeria"
  description: "140–160 characters for Google, including the main keyword."
  canonical: ""
  noindex: false
cta: default
related: []
---

Opening paragraph…

## A main section

Text…

### A subsection

![Describe the photo](/assets/blog/uploads/another-photo.jpg "Optional caption shown under the image")

Link to [another article](/blog/how-to-ask-photography-clients-for-referrals/) or to [early access](/early-access.html).
```

4. Click **Commit changes**.

| Field | What to put |
| --- | --- |
| `title` | The headline. It becomes the page’s H1. |
| `status` | `draft` keeps it off the site, `published` puts it live and `archived` takes it down. |
| `date` | When it should appear. A future date **schedules** it, and it goes live within the hour after that time. Keep the `+01:00` (Nigeria time). |
| `category` | One of the file names in `_data/categories/`: `photography-business`, `client-retention`, `marketing`, `bookings-sales`, `whatsapp-marketing` or `business-growth`. |
| `tags` | Optional, 2–5 keywords. |
| `excerpt` | 1–2 sentences for cards and under the title. |
| `featured_image` + `featured_image_alt` | The top image, also used when the link is shared on WhatsApp. Always describe the photo in the alt text. |
| `seo.title` / `seo.description` | What Google shows. Keep the title under 60 characters and the description to 140–160. Leave `canonical` empty unless the article first appeared on another site. |
| `cta` | Which end-of-article box to show: a file name from `_data/ctas/`. |
| `related` | Optional list of article file names (without `.md`). Leave `[]` to choose automatically. |

Anything in quotes that contains a colon must stay in quotes.

### Writing tips for SEO

- **Headings:** use `##` for main sections and `###` for subsections. Don’t use `#`, because the title already is the H1. If you do, it’s demoted automatically.
- **Images:** `![alt text](/assets/blog/uploads/photo.jpg "Caption")`. Always write the alt text; the quoted caption is optional.
- **Internal links:** `[link text](path)`, where the path is one of:
  - another article: `/blog/how-to-ask-photography-clients-for-referrals/`
  - early access / sign-up: `/early-access.html`
  - features: `/#features`
- **Getting the most from each article:** link to 2–4 other pages on the site, and use the main keyword in the first paragraph and in one Heading 2.

### Updating, unpublishing and scheduling

- **Update an article:** open the file, click the pencil icon, edit, and commit. If the change is meaningful, add a line such as `updated: 2026-11-02T09:00:00+01:00` under `date`, which tells Google the content is fresh.
- **Unpublish:** change `status` to `archived` (or `draft`) and commit. The page, its sitemap entry and its search result are removed on the next build.
- **Schedule:** set `status: published` with a future `date`. Until then it isn’t on the site at all.
- **Change a URL:** rename the file. The old URL stops working, so avoid this once an article has been shared.

### Categories, calls to action and settings

- **Categories:** one file each in `_data/categories/`, with `name` and `description`. The file name is what articles use in `category:`. Keep the list short. A category page (ndylens.com/blog/category/…) only exists once it has at least one published article.
- **Calls to action:** one file each in `_data/ctas/`, with `heading`, `text`, `button_label` and `button_link`. Editing one updates every article that uses it.
- **Blog settings:** `_data/blog.yml` holds the blog page’s title and description, articles per page, default author and default call to action.

---

## One-time setup

These steps are done once, by whoever manages the GitHub repository.

### 1. Switch GitHub Pages to the build workflow

The site is now built by `.github/workflows/deploy.yml` rather than served straight from the repository files.

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. Merge the `blog` branch into `main`. The workflow runs and publishes the site.
3. Check **Actions** for a green run, then confirm the homepage and ndylens.com/blog/ both load.

The custom domain is kept because `CNAME` is copied into the build.

### 2. Give the content person access

Articles are files in this repository, so each writer needs a **GitHub account with write access**: **Settings → Collaborators → Add people**.

### 3. Google Search Console

1. Add the property `https://www.ndylens.com` in [Search Console](https://search.google.com/search-console). DNS verification is easiest: add the TXT record in Cloudflare.
2. **Sitemaps:** submit `https://www.ndylens.com/sitemap.xml`. New articles are added to it automatically.

### 4. Cloudflare checks

- **robots.txt:** Cloudflare’s *managed robots.txt* feature adds its own lines to ours. That’s fine, but make sure no Cloudflare setting blocks Googlebot.
- **Caching:** there’s nothing to change. Blog images have content-hashed filenames, and CSS/JS carry `?v=` hashes.

### Good to know

- **Scheduled posts and inactivity:** GitHub pauses hourly (scheduled) workflows after **60 days with no commits**. If the blog goes quiet for two months, re-enable the workflow in **Actions**, or just publish something.
- **Analytics:** blog visits and clicks go into the existing Events sheet (see `TRACKING.md`):
  - `page_view`: one row per article view, with the traffic source.
  - `scroll_depth`: how far people read.
  - `cta_click`: clicks from articles to NDYLens. `detail` names the article, e.g. `blog-post · how-to-get-more-repeat-photography-clients`.

  Early-access applications keep the first page a visitor landed on (`landingPage`), so sign-ups that started on the blog can be counted.

---

## How it works (for developers)

- **Build:** [Eleventy](https://www.11ty.dev/) builds the blog into `_site/`. The hand-written pages (`index.html`, `early-access.html`, `privacy.html`, `terms.html`) are copied as-is, not templated.
- **Content:** Markdown files in `blog/posts/`, with images in `assets/blog/uploads/`.
- **Deploy:** GitHub Actions builds on every push and hourly, and deploys to GitHub Pages. The hourly run only deploys when the sitemap would change, i.e. when a scheduled post has come due.

| Path | Purpose |
| --- | --- |
| `blog/posts/*.md` | Articles. File name = URL slug. |
| `blog/posts/posts.11tydata.js` | Publishing rules, SEO fields, BlogPosting/Breadcrumb JSON-LD. |
| `_config/posts.js` | `isLive` (published and date reached), reading time, related posts. |
| `_config/markdown.js` | One H1 per page, heading ids, `![alt](src "caption")` → `<figure>`. |
| `_data/blog.yml`, `_data/categories/`, `_data/ctas/` | Settings, categories, calls to action. |
| `_includes/` | Layouts and partials. |
| `blog/index.njk`, `blog/category.njk`, `blog/search.njk`, `blog/feed.njk` | Listing (paginated), category pages, search, RSS. |
| `sitemap.njk`, `robots.njk`, `404.njk` | Sitemap, robots.txt, not-found page. |
| `blog.css` | Blog styles, loaded only on blog pages. |

**Images** go through `@11ty/eleventy-img` at build time: every `<img>` becomes a `<picture>` with AVIF, WebP and JPEG sources at 400–1440px, with width and height set. Social previews get a 1200px JPEG.

**Search** uses [Pagefind](https://pagefind.app/): a static index built after Eleventy, loaded only on `/blog/search/`.

```sh
npm install
npm start            # http://localhost:8080 — live site as it would publish
npm run preview      # same, but drafts and scheduled posts are shown (marked, noindex)
npm run build        # full build incl. search index → _site/
```

After editing `styles.css`, `script.js` or homepage images, still run `./stamp-assets.sh` for the hand-written pages. Blog pages hash their assets automatically.
