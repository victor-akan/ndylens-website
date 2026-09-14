// Defaults for every file in blog/posts/ — i.e. every article.
import { isLive } from "../../_config/posts.js";

export default {
  layout: "layouts/post.njk",
  eleventyComputed: {
    // The file name is the URL slug:
    // /blog/how-to-get-more-repeat-photography-clients/
    // Drafts, archived posts and not-yet-due scheduled posts get no page.
    permalink: (data) => (isLive(data) ? `/blog/${data.page.fileSlug}/` : false),
    author: (data) => data.author || data.blog.default_author,
    metaTitle: (data) => data.seo?.title || data.title,
    metaDescription: (data) => data.seo?.description || data.excerpt || data.blog.description,
    canonical: (data) => data.seo?.canonical || `${data.site.url}/blog/${data.page.fileSlug}/`,
    // Drafts only ever render in local preview mode; never let one be indexed.
    noindex: (data) => Boolean(data.seo?.noindex) || data.status !== "published",
    ogType: "article",
    categoryData: (data) => data.categories?.[data.category],
    ctaData: (data) => data.ctas?.[data.cta] || data.ctas?.[data.blog.default_cta],

    // BlogPosting + BreadcrumbList structured data.
    jsonld: (data) => {
      const url = `${data.site.url}/blog/${data.page.fileSlug}/`;
      const author = data.author || data.blog.default_author;
      const category = data.categories?.[data.category];
      const org = {
        "@type": "Organization",
        name: data.site.name,
        url: data.site.url,
        logo: { "@type": "ImageObject", url: data.site.url + data.site.logo },
      };
      const crumbs = [
        { name: "Blog", item: `${data.site.url}/blog/` },
        ...(category ? [{ name: category.name, item: `${data.site.url}/blog/category/${data.category}/` }] : []),
        { name: data.title, item: url },
      ];
      return {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BlogPosting",
            "@id": `${url}#article`,
            headline: data.title,
            description: data.seo?.description || data.excerpt,
            ...(data.featured_image ? { image: [new URL(data.featured_image, data.site.url).href] } : {}),
            datePublished: new Date(data.page.date).toISOString(),
            dateModified: new Date(data.updated || data.page.date).toISOString(),
            // "NDYLens Team" is the company, not a person.
            author: /ndylens/i.test(author) ? org : { "@type": "Person", name: author },
            publisher: org,
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            ...(category ? { articleSection: category.name } : {}),
            ...(data.tags?.length ? { keywords: data.tags.join(", ") } : {}),
            inLanguage: data.site.lang,
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })),
          },
        ],
      };
    },
  },
};
