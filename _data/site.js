// Site-wide constants for the blog templates. The hand-written pages
// (index.html, privacy.html, …) do not read this; they are copied as-is.
export default {
  name: "NDYLens",
  url: "https://www.ndylens.com",
  logo: "/assets/images/logo-icon.png",
  locale: "en_NG",
  lang: "en-NG",
  // Build time. Posts dated after this are scheduled and stay unpublished
  // until a later build — the hourly workflow run picks them up.
  now: new Date(),
  // Set BLOG_PREVIEW=1 to render drafts and scheduled posts locally.
  preview: process.env.BLOG_PREVIEW === "1",
};
