// The blog home: /blog/, /blog/page/2/, … Page size comes from the
// posts_per_page in _data/blog.yml.
import fs from "node:fs";
import * as yaml from "js-yaml";

const settings = yaml.load(fs.readFileSync(new URL("../_data/blog.yml", import.meta.url), "utf8"));

export default {
  layout: "layouts/base.njk",
  pagination: {
    data: "collections.posts",
    size: Number(settings.posts_per_page) || 9,
    alias: "posts",
    generatePageOnEmptyData: true,
  },
  permalink: (data) =>
    data.pagination.pageNumber === 0 ? "/blog/" : `/blog/page/${data.pagination.pageNumber + 1}/`,
  eleventyComputed: {
    metaTitle: (data) =>
      data.pagination.pageNumber === 0
        ? "Blog | NDYLens — Guides for Nigerian Photographers"
        : `Blog — Page ${data.pagination.pageNumber + 1} | NDYLens`,
    metaDescription: (data) => data.blog.description,
    canonical: (data) => data.site.url + data.page.url,
    ogTitle: "The NDYLens Blog",
    jsonld: (data) => ({
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": `${data.site.url}/blog/#blog`,
      name: "NDYLens Blog",
      description: data.blog.description,
      url: `${data.site.url}/blog/`,
      inLanguage: data.site.lang,
      publisher: { "@type": "Organization", name: data.site.name, url: data.site.url },
    }),
  },
};
