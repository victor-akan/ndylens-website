# NDYLens Blog

The blog lives at **ndylens.com/blog/** and is edited at **ndylens.com/admin/**.
No code or HTML is needed to write, schedule, update or remove an article.

- [Publishing an article](#publishing-an-article)
- [One-time setup](#one-time-setup)
- [How it works (for developers)](#how-it-works-for-developers)

---

## Publishing an article

1. Go to **ndylens.com/admin/** and sign in.
2. Open **Posts → New Post**.
3. Fill in the fields:

| Field | What to put |
| --- | --- |
| **Title** | The headline. It becomes the page’s H1. |
| **Slug** | The URL, e.g. `how-to-price-wedding-photography` → ndylens.com/blog/how-to-price-wedding-photography/. It’s suggested from the title. **Check it before the first save**, because changing it later changes the URL. |
| **Status** | **Draft** keeps it off the site. **Published** puts it live. **Archived** takes it down. |
| **Publish date** | When it should appear. A future date **schedules** it, and it goes live within the hour after that time. |
| **Author** | Defaults to “NDYLens Team”. |
| **Category** | Pick one. |
| **Tags** | Optional, 2–5 keywords. |
| **Excerpt** | 1–2 sentences for article cards and under the title. |
| **Featured image** + **alt text** | The top image, also used when the link is shared on WhatsApp. Always describe the photo in the alt text. |
| **Article** | The body (see writing tips below). |
| **SEO** | **SEO title** (under 60 characters) and **Meta description** (140–160 characters). Leave **Canonical URL** empty unless the article first appeared on another site. |
| **Call to action** | The box at the end. Leave empty to use the default. |
| **Related articles** | Optional. Empty means they’re chosen automatically. |

4. Use the **preview** pane beside the editor to check how it looks.
5. Click **Save**. The site updates about **1–2 minutes** later.

### Writing tips for SEO

- **Headings:** use **Heading 2** for main sections and **Heading 3** for subsections. Don’t use Heading 1, because the title already is one. If you do, it’s demoted automatically.
- **Images:** click the image button, upload, and always fill in the **alt text**. Whatever you type in the image’s **Title** box appears as a **caption** under it. Upload the best-quality photo you have; the site makes small, fast versions for phones automatically.
- **Internal links:** select text, click the link button, and paste a path:
  - another article: `/blog/how-to-ask-photography-clients-for-referrals/`
  - early access / sign-up: `/early-access.html`
  - features: `/#features`
- **Getting the most from each article:** link to 2–4 other pages on the site, and use the main keyword in the first paragraph and in one Heading 2.

### Updating, unpublishing and scheduling

- **Update an article:** open it, edit, and Save. If the change is meaningful, also set **Last updated**, which tells Google the content is fresh.
- **Unpublish:** set Status to **Archived** (or **Draft**) and Save. The page, its sitemap entry and its search result are removed on the next build.
- **Schedule:** set Status to **Published** with a future **Publish date**. Until then it isn’t on the site at all.

### Categories, calls to action and settings

- **Categories:** add or rename them here. Keep the list short. A category page (ndylens.com/blog/category/…) only exists once it has at least one published article.
- **Calls to action:** reusable end-of-article boxes. Editing one updates every article that uses it.
- **Settings → Blog settings:** the blog page’s title and description, articles per page, default author and default call to action.

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

The CMS saves articles to this repository, so each editor needs a **GitHub account with write access** (**Settings → Collaborators → Add people**).

**Option A — quick start (no extra setup).** On the admin sign-in screen, the editor clicks **Sign In with Token**, follows the link to create a GitHub token with the pre-selected permissions, and pastes it in. It stays signed in on that browser.

**Option B — a normal “Sign in with GitHub” button (recommended).** This takes about 15 minutes. It uses a small free Cloudflare Worker, and the site is already on Cloudflare.

1. Deploy [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) to Cloudflare Workers using its “Deploy” button.
2. Create a GitHub OAuth App (**GitHub → Settings → Developer settings → OAuth Apps**). Set the Homepage URL to `https://www.ndylens.com` and the Callback URL to `https://<your-worker>.workers.dev/callback`.
3. Add the app’s client ID and secret to the worker as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and set `ALLOWED_DOMAINS` to `www.ndylens.com`.
4. In `admin/config.yml`, uncomment `base_url:` and set it to the worker URL.

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
- **CMS:** [Sveltia CMS](https://sveltiacms.app/) at `/admin/` (config: `admin/config.yml`) commits Markdown to `blog/posts/` and images to `assets/blog/uploads/`.
- **Deploy:** GitHub Actions builds on every push and hourly, and deploys to GitHub Pages. The hourly run only deploys when the sitemap would change, i.e. when a scheduled post has come due.

| Path | Purpose |
| --- | --- |
| `blog/posts/*.md` | Articles. File name = URL slug. |
| `blog/posts/posts.11tydata.js` | Publishing rules, SEO fields, BlogPosting/Breadcrumb JSON-LD. |
| `_config/posts.js` | `isLive` (published and date reached), reading time, related posts. |
| `_config/markdown.js` | One H1 per page, heading ids, `![alt](src "caption")` → `<figure>`. |
| `_data/blog.yml`, `_data/categories/`, `_data/ctas/` | Settings, categories, calls to action (all CMS-editable). |
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
