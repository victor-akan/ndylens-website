/* ===================================================================
   NDYLens landing v2 — interactions
   - lead form (Google Apps Script) + first/last-touch attribution (preserved)
   - nav scroll state + mobile menu
   - scroll reveals, number counters, animated WhatsApp chat
   =================================================================== */

const SHEETS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbz-o7g6Zbx2c95AO9WdrmuzhWDEZf9bv-SuOPBfGmuN5LixyremjbeR0j1hwI65YLIm1Q/exec";

/* ---------- year ---------- */
document.getElementById("yr").textContent = new Date().getFullYear();

/* ---------- nav: scrolled state + mobile menu ---------- */
const nav = document.getElementById("nav");
const burger = document.getElementById("burger");
const navLinks = document.getElementById("nav-links");

const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

burger.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  })
);

/* ---------- scroll reveals ---------- */
const revealItems = document.querySelectorAll(".reveal");
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const delay = e.target.getAttribute("data-reveal-delay") || 0;
      setTimeout(() => e.target.classList.add("in"), delay);
      revealObs.unobserve(e.target);
    });
  },
  { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
);
revealItems.forEach((el) => revealObs.observe(el));

/* ---------- number counters ---------- */
function animateCount(el) {
  const target = parseFloat(el.getAttribute("data-count"));
  const dur = 1400;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString();
  };
  requestAnimationFrame(step);
}
const countObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      animateCount(e.target);
      countObs.unobserve(e.target);
    });
  },
  { threshold: 0.6 }
);
document.querySelectorAll("[data-count]").forEach((el) => countObs.observe(el));

/* ---------- animated WhatsApp chat (how-it-works phone) ---------- */
const chat = document.getElementById("chat-body");
if (chat) {
  const items = [...chat.querySelectorAll("[data-seq]")].sort(
    (a, b) => a.dataset.seq - b.dataset.seq
  );
  let played = false;
  const playChat = () => {
    if (played) return;
    played = true;
    const timings = [400, 1300, 2400, 3400, 4600]; // per bubble reveal
    items.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add("show");
        if (el.classList.contains("typing")) {
          // hide the typing indicator shortly before the reply appears
          setTimeout(() => el.classList.remove("show"), 1000);
        }
        chat.scrollTop = chat.scrollHeight;
      }, timings[i] || i * 1000);
    });
  };
  const phoneObs = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && playChat()),
    { threshold: 0.4 }
  );
  phoneObs.observe(document.getElementById("phone"));
}

/* =================================================================
   LEAD ATTRIBUTION (first-touch stored, last-touch live) — preserved
   ================================================================= */
function parseHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function bucketFromSource(host) {
  if (!host) return "direct";
  const h = host.toLowerCase();
  if (/instagram|ig/.test(h)) return "instagram";
  if (/facebook|fb\.|fbclid/.test(h)) return "facebook";
  if (/whatsapp|wa\.me/.test(h)) return "whatsapp";
  if (/t\.co|twitter|x\.com/.test(h)) return "twitter";
  if (/tiktok/.test(h)) return "tiktok";
  if (/google|bing|duckduckgo/.test(h)) return "search";
  if (/youtube/.test(h)) return "youtube";
  return "referral";
}
function currentTouch() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source") || "";
  const refHost = parseHost(document.referrer);
  const bucket = utmSource
    ? bucketFromSource(utmSource)
    : bucketFromSource(refHost);
  return {
    sourceBucket: bucket,
    sourceDetail: utmSource || refHost || "direct",
    utmSource,
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || "",
    referrer: document.referrer || "",
    landingPage: window.location.href,
  };
}
function getLeadAttribution() {
  const lastTouch = currentTouch();
  let firstTouch = lastTouch;
  try {
    const stored = localStorage.getItem("ndy_first_touch");
    if (stored) firstTouch = JSON.parse(stored);
    else localStorage.setItem("ndy_first_touch", JSON.stringify(lastTouch));
  } catch {
    /* storage blocked — first == last */
  }
  return { firstTouch, lastTouch };
}

/* =================================================================
   LEAD FORM SUBMIT (Google Apps Script) — preserved payload shape
   ================================================================= */
const leadFormEl = document.getElementById("lead-form");
const leadSubmitEl = document.getElementById("lead-submit");
const leadStatusEl = document.getElementById("lead-status");

function setLeadStatus(msg, kind) {
  leadStatusEl.textContent = msg;
  leadStatusEl.className = "form-status" + (kind ? " " + kind : "");
}

if (leadFormEl) {
  leadFormEl.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const formData = new FormData(leadFormEl);

    // honeypot — silently drop bots
    if (String(formData.get("website") || "").trim() !== "") {
      setLeadStatus("Thanks! We'll be in touch.", "ok");
      leadFormEl.reset();
      return;
    }

    const attribution = getLeadAttribution();
    const payload = {
      timestamp: new Date().toISOString(),
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      phoneNumber: String(formData.get("phoneNumber") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      businessName: String(formData.get("businessName") || "").trim(),
      businessLocation: String(formData.get("businessLocation") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      pageUrl: window.location.href,
      sourceBucket: attribution.firstTouch.sourceBucket,
      sourceDetail: attribution.firstTouch.sourceDetail,
      firstTouchUtmSource: attribution.firstTouch.utmSource,
      firstTouchUtmMedium: attribution.firstTouch.utmMedium,
      firstTouchUtmCampaign: attribution.firstTouch.utmCampaign,
      lastTouchSourceBucket: attribution.lastTouch.sourceBucket,
      lastTouchSourceDetail: attribution.lastTouch.sourceDetail,
      lastTouchUtmSource: attribution.lastTouch.utmSource,
      lastTouchUtmMedium: attribution.lastTouch.utmMedium,
      lastTouchUtmCampaign: attribution.lastTouch.utmCampaign,
      lastTouchUtmContent: attribution.lastTouch.utmContent,
      lastTouchUtmTerm: attribution.lastTouch.utmTerm,
      referrer: attribution.lastTouch.referrer,
      landingPage: attribution.firstTouch.landingPage,
    };

    leadSubmitEl.disabled = true;
    const prev = leadSubmitEl.innerHTML;
    leadSubmitEl.textContent = "Sending…";
    setLeadStatus("Sending your details…");

    const send = (mode) =>
      fetch(SHEETS_WEB_APP_URL, {
        method: "POST",
        ...(mode ? { mode } : {}),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

    try {
      const res = await send();
      if (!res.ok) throw new Error("primary failed");
      setLeadStatus("You're in! We'll reach out on WhatsApp shortly. 🎉", "ok");
      leadFormEl.reset();
    } catch {
      try {
        await send("no-cors"); // Apps Script without CORS headers
        setLeadStatus("You're in! We'll reach out on WhatsApp shortly. 🎉", "ok");
        leadFormEl.reset();
      } catch {
        setLeadStatus("Couldn't send — please WhatsApp us instead.", "err");
      }
    } finally {
      leadSubmitEl.disabled = false;
      leadSubmitEl.innerHTML = prev;
    }
  });
}
